import '@tanstack/react-start/server-only'

import { unzipSync } from 'fflate'
import { GarminConnect } from 'garmin-connect-2fa'
import { getServerEnv } from '@/env'
import {
  activityIdentity,
  activityStartEpochSeconds,
  buildActivityDetails,
  type GarminConnectActivity,
  type GarminConnectBatch,
  isAfterWatermark,
  isDiveActivity,
  nextAdapterState,
  parseAdapterState,
} from '../connect-envelope'
import { loadGarminTokens, saveGarminTokens } from './credentials.server'

export type GarminConnectMode = 'full' | 'incremental'

export interface GarminConnectBatchSource {
  fetchBatch(
    mode: GarminConnectMode,
    state: Record<string, unknown>,
  ): Promise<GarminConnectBatch>
}

async function createClient() {
  const environment = getServerEnv()
  const tokens = await loadGarminTokens()
  if (!tokens) {
    throw new Error(
      'Garmin Connect is not connected yet. Connect the account in Settings → Integrations first.',
    )
  }
  const client = new GarminConnect(
    { username: '', password: '' },
    environment.GARMIN_DOMAIN,
  )
  client.loadToken(tokens.oauth1 as never, tokens.oauth2 as never)
  return client
}

function toBytes(payload: unknown): Uint8Array {
  if (payload instanceof Uint8Array) return payload
  if (payload instanceof ArrayBuffer) return new Uint8Array(payload)
  throw new Error('Garmin Connect returned an unexpected FIT download payload')
}

async function downloadOriginalFit(
  client: GarminConnect,
  activityId: string,
  maximumFitBytes: number,
) {
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
  if (bytes.byteLength > maximumFitBytes) {
    throw new Error(`Garmin FIT payload exceeds ${maximumFitBytes} bytes`)
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
 * transactional batch the Garmin connector consumes. The unofficial consumer
 * API lists activities newest-first; incremental mode stops paging once a page
 * ends below the stored watermark minus the overlap.
 */
export class GarminConnectSource implements GarminConnectBatchSource {
  async fetchBatch(
    mode: GarminConnectMode,
    state: Record<string, unknown>,
  ): Promise<GarminConnectBatch> {
    const environment = getServerEnv()
    const watermark = parseAdapterState(state)
    const client = await createClient()
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

    const activities: GarminConnectActivity[] = []
    for (const item of collected) {
      const fitBytes = await downloadOriginalFit(
        client,
        item.activityId,
        environment.GARMIN_MAX_FIT_BYTES,
      )
      activities.push({
        activityDetails: buildActivityDetails(item.raw),
        fitBase64: Buffer.from(fitBytes).toString('base64'),
        fitFileName: `${item.activityId}.fit`,
        fitContentType: 'application/vnd.ant.fit',
      })
    }

    // Persist tokens that the client may have refreshed during the batch.
    const tokens = client.exportToken()
    await saveGarminTokens({
      oauth1: tokens.oauth1 as unknown as Record<string, unknown>,
      oauth2: tokens.oauth2 as unknown as Record<string, unknown>,
    })

    return {
      activities,
      nextState: nextAdapterState(
        watermark,
        collected.map((item) => item.startEpochSeconds),
      ),
      sourceDescription: `Garmin Connect ${mode} activity sweep`,
      complete: !truncated,
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
