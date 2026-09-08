import '@tanstack/react-start/server-only'

import { unzipSync } from 'fflate'
import { GarminConnect } from 'garmin-connect-2fa'
import { getServerEnv } from '@/env'
import {
  buildDiveActivityDetails,
  type GarminConnectActivity,
  type GarminConnectBatch,
  type GarminConnectGear,
  isAfterWatermark,
  nextAdapterState,
  parseAdapterState,
} from '../connect-envelope'
import { createGarminDiveClient, exchangeForDiveToken } from '../dive-api'
import { loadGarminTokens, saveGarminTokens } from './credentials.server'

export type GarminConnectMode = 'full' | 'incremental'

export interface GarminConnectFetchOptions {
  includeGear?: boolean
}

export interface GarminConnectBatchSource {
  fetchBatch(
    mode: GarminConnectMode,
    state: Record<string, unknown>,
    options?: GarminConnectFetchOptions,
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

function unzipFit(archive: Uint8Array, activityId: string, maximumFitBytes: number) {
  const entries = unzipSync(archive)
  const fitEntry = Object.keys(entries).find((name) =>
    name.toLowerCase().endsWith('.fit'),
  )
  if (!fitEntry) {
    throw new Error(`Garmin activity ${activityId} download contains no FIT file`)
  }
  const bytes = entries[fitEntry]
  if (!bytes) {
    throw new Error(`Garmin activity ${activityId} FIT entry is empty`)
  }
  if (bytes.byteLength > maximumFitBytes) {
    throw new Error(`Garmin FIT payload exceeds ${maximumFitBytes} bytes`)
  }
  return bytes
}

interface CollectedDive {
  raw: Record<string, unknown>
  connectActivityId: string | null
  startEpochSeconds: number | null
}

function diveStartEpochSeconds(raw: Record<string, unknown>): number | null {
  const text = typeof raw.startTime === 'string' ? raw.startTime : null
  if (!text) return null
  const parsed = Date.parse(text)
  return Number.isNaN(parsed) ? null : Math.round(parsed / 1_000)
}

/**
 * Lists dives through the Garmin Dive service — the backend of the Garmin Dive
 * app — and downloads each dive's original FIT file from Connect with the same
 * Dive-scoped token. The dive list is newest-first and paged; incremental mode
 * stops paging once a page ends below the stored watermark minus the overlap.
 * Dives logged by hand in the app have no Connect activity and no FIT file;
 * they are still imported from their summary.
 */
export class GarminConnectSource implements GarminConnectBatchSource {
  async fetchBatch(
    mode: GarminConnectMode,
    state: Record<string, unknown>,
    options: GarminConnectFetchOptions = {},
  ): Promise<GarminConnectBatch> {
    const environment = getServerEnv()
    const watermark = parseAdapterState(state)
    const client = await createClient()
    // Any request through the Connect client refreshes an expired token first;
    // the Dive exchange below needs a live one.
    await client.getUserProfile()
    const connectAccessToken = client.exportToken().oauth2.access_token
    if (typeof connectAccessToken !== 'string') {
      throw new Error('Garmin Connect session has no OAuth2 access token')
    }
    const dive = createGarminDiveClient(await exchangeForDiveToken(connectAccessToken))

    const collected: CollectedDive[] = []
    const seen = new Set<string>()
    let scanned = 0
    let page = 0
    let truncated = false
    while (true) {
      const result = await dive.listDives(page, environment.GARMIN_ACTIVITY_PAGE_SIZE)
      const entries = result.dives
      if (entries.length === 0) break
      scanned += entries.length
      let pageEndedBelowWatermark = false
      for (const entry of entries) {
        const startEpochSeconds = diveStartEpochSeconds(entry.raw)
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
        const identity = String(buildDiveActivityDetails(entry.raw).activityId)
        if (seen.has(identity)) continue
        seen.add(identity)
        collected.push({
          raw: entry.raw,
          connectActivityId:
            entry.connectActivityId !== null ? String(entry.connectActivityId) : null,
          startEpochSeconds,
        })
      }
      if (mode === 'incremental' && pageEndedBelowWatermark) break
      page += 1
      if (
        mode === 'full' &&
        page * environment.GARMIN_ACTIVITY_PAGE_SIZE >=
          environment.GARMIN_FULL_IMPORT_MAX_ACTIVITIES
      ) {
        truncated = true
        break
      }
      if (
        entries.length < environment.GARMIN_ACTIVITY_PAGE_SIZE ||
        (result.totalCount !== null && scanned >= result.totalCount)
      ) {
        break
      }
    }

    const activities: GarminConnectActivity[] = []
    let manualDives = 0
    for (const item of collected) {
      const activityDetails = buildDiveActivityDetails(item.raw)
      if (item.connectActivityId === null) {
        manualDives += 1
        activities.push({ activityDetails })
        continue
      }
      const fitBytes = unzipFit(
        await dive.downloadFitArchive(item.connectActivityId),
        item.connectActivityId,
        environment.GARMIN_MAX_FIT_BYTES,
      )
      activities.push({
        activityDetails,
        fitBytes,
        fitFileName: `${item.connectActivityId}.fit`,
        fitContentType: 'application/vnd.ant.fit',
      })
    }

    // Gear and certifications live in the same Dive service. A failure there
    // must not cost the dive import, so it is reported in diagnostics and the
    // gear list is left out of the batch.
    let gear: GarminConnectGear[] | undefined
    let gearError: string | undefined
    if (options.includeGear) {
      try {
        gear = await fetchDiveGear(dive)
      } catch (error) {
        gearError = error instanceof Error ? error.message : String(error)
      }
    }

    // Persist tokens that the client may have refreshed during the batch.
    const tokens = client.exportToken()
    await saveGarminTokens({
      oauth1: tokens.oauth1 as unknown as Record<string, unknown>,
      oauth2: tokens.oauth2 as unknown as Record<string, unknown>,
    })

    return {
      activities,
      ...(gear ? { gear } : {}),
      nextState: nextAdapterState(
        watermark,
        collected.map((item) => item.startEpochSeconds),
      ),
      sourceDescription: `Garmin Dive ${mode} dive sweep`,
      complete: !truncated,
      diagnostics: {
        divesScanned: scanned,
        divesSelected: collected.length,
        ...(manualDives > 0 ? { manualDives } : {}),
        ...(gear ? { gearItems: gear.length } : {}),
        ...(gearError ? { gearError } : {}),
        ...(truncated
          ? { truncatedAt: environment.GARMIN_FULL_IMPORT_MAX_ACTIVITIES }
          : {}),
      },
    }
  }
}

async function fetchDiveGear(
  dive: ReturnType<typeof createGarminDiveClient>,
): Promise<GarminConnectGear[]> {
  const summaries = await dive.listGear()
  const gear: GarminConnectGear[] = []
  for (const summary of summaries) {
    const detail = await dive.getGear(summary.gearId)
    gear.push({ gearId: String(summary.gearId), type: detail.type, detail: detail.raw })
  }
  return gear
}
