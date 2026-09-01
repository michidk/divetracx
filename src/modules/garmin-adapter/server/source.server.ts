import '@tanstack/react-start/server-only'

import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { unzipSync } from 'fflate'
import { GarminConnect } from 'garmin-connect'
import {
  activityIdentity,
  activityStartEpochSeconds,
  buildActivityDetails,
  type GarminAdapterActivity,
  type GarminAdapterBatch,
  isAfterWatermark,
  isDiveActivity,
  nextAdapterState,
  parseAdapterState,
} from '../envelope'
import {
  type GarminAdapterEnvironment,
  getGarminAdapterEnvironment,
} from './environment.server'

export type GarminAdapterMode = 'full' | 'incremental'

export interface GarminAdapterBatchSource {
  fetchBatch(
    mode: GarminAdapterMode,
    state: Record<string, unknown>,
  ): Promise<GarminAdapterBatch>
}

function hasStoredTokens(tokenDirectory: string) {
  return (
    existsSync(join(tokenDirectory, 'oauth1_token.json')) &&
    existsSync(join(tokenDirectory, 'oauth2_token.json'))
  )
}

async function createClient(environment: GarminAdapterEnvironment) {
  const client = new GarminConnect(
    {
      username: environment.GARMIN_EMAIL ?? '',
      password: environment.GARMIN_PASSWORD ?? '',
    },
    environment.GARMIN_DOMAIN,
  )
  if (hasStoredTokens(environment.GARMIN_TOKEN_DIRECTORY)) {
    client.loadTokenByFile(environment.GARMIN_TOKEN_DIRECTORY)
    return client
  }
  if (environment.GARMIN_EMAIL && environment.GARMIN_PASSWORD) {
    await client.login()
    mkdirSync(environment.GARMIN_TOKEN_DIRECTORY, { recursive: true })
    client.exportTokenToFile(environment.GARMIN_TOKEN_DIRECTORY)
    return client
  }
  throw new Error(
    `No Garmin Connect tokens found in ${environment.GARMIN_TOKEN_DIRECTORY}. ` +
      'Run `bun run garmin:login` against the token volume first.',
  )
}

function toBytes(payload: unknown): Uint8Array {
  if (payload instanceof Uint8Array) return payload
  if (payload instanceof ArrayBuffer) return new Uint8Array(payload)
  throw new Error('Garmin Connect returned an unexpected FIT download payload')
}

async function downloadOriginalFit(client: GarminConnect, activityId: string) {
  const payload = await client.client.get<unknown>(
    `${client.client.url.DOWNLOAD_ZIP}${activityId}`,
    { responseType: 'arraybuffer' },
  )
  const archive = unzipSync(toBytes(payload))
  const fitEntry = Object.keys(archive).find((name) =>
    name.toLowerCase().endsWith('.fit'),
  )
  if (!fitEntry) {
    throw new Error(`Garmin activity ${activityId} download contains no FIT file`)
  }
  const bytes = archive[fitEntry]
  if (!bytes) {
    throw new Error(`Garmin activity ${activityId} FIT entry is empty`)
  }
  return bytes
}

interface CollectedActivity {
  raw: Record<string, unknown>
  activityId: string
  startEpochSeconds: number | null
}

/**
 * Fetches dive activities from Garmin Connect and converts them into the
 * transactional batch envelope the Divetracx Garmin connector consumes. The
 * unofficial consumer API lists activities newest-first; incremental mode stops
 * paging once a page ends below the stored watermark minus the overlap.
 */
export class GarminConnectSource implements GarminAdapterBatchSource {
  constructor(
    private readonly environment: GarminAdapterEnvironment = getGarminAdapterEnvironment(),
  ) {}

  async fetchBatch(
    mode: GarminAdapterMode,
    state: Record<string, unknown>,
  ): Promise<GarminAdapterBatch> {
    const environment = this.environment
    const watermark = parseAdapterState(state)
    const client = await createClient(environment)
    const collected: CollectedActivity[] = []
    const seen = new Set<string>()
    let scanned = 0
    let start = 0
    let truncated = false

    while (true) {
      const page = (await client.getActivities(
        start,
        environment.GARMIN_ACTIVITY_PAGE_SIZE,
      )) as unknown as Record<string, unknown>[]
      if (page.length === 0) break
      scanned += page.length
      let pageEndedBelowWatermark = false
      for (const raw of page) {
        const startEpochSeconds = activityStartEpochSeconds(raw)
        const inWindow =
          mode === 'full' ||
          isAfterWatermark(
            startEpochSeconds,
            watermark,
            environment.GARMIN_INCREMENTAL_OVERLAP_SECONDS,
          )
        if (!inWindow) {
          pageEndedBelowWatermark = true
          continue
        }
        if (!isDiveActivity(raw)) continue
        const activityId = activityIdentity(raw)
        if (!activityId || seen.has(activityId)) continue
        seen.add(activityId)
        collected.push({ raw, activityId, startEpochSeconds })
      }
      if (mode === 'incremental' && pageEndedBelowWatermark) break
      start += page.length
      if (mode === 'full' && start >= environment.GARMIN_FULL_IMPORT_MAX_ACTIVITIES) {
        truncated = true
        break
      }
      if (page.length < environment.GARMIN_ACTIVITY_PAGE_SIZE) break
    }

    const activities: GarminAdapterActivity[] = []
    for (const item of collected) {
      const fitBytes = await downloadOriginalFit(client, item.activityId)
      activities.push({
        activityDetails: buildActivityDetails(item.raw),
        fitBase64: Buffer.from(fitBytes).toString('base64'),
        fitFileName: `${item.activityId}.fit`,
        fitContentType: 'application/vnd.ant.fit',
      })
    }

    // Persist tokens that the client may have refreshed during the batch.
    mkdirSync(environment.GARMIN_TOKEN_DIRECTORY, { recursive: true })
    client.exportTokenToFile(environment.GARMIN_TOKEN_DIRECTORY)

    return {
      activities,
      nextState: nextAdapterState(
        watermark,
        collected.map((item) => item.startEpochSeconds),
      ),
      sourceDescription: `Garmin Connect ${mode} activity sweep`,
      diagnostics: {
        activitiesScanned: scanned,
        diveActivitiesSelected: collected.length,
        ...(truncated
          ? { truncatedAt: environment.GARMIN_FULL_IMPORT_MAX_ACTIVITIES }
          : {}),
      },
    }
  }
}
