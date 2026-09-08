import '@tanstack/react-start/server-only'

import { GarminConnect } from 'garmin-connect-2fa'
import { getServerEnv } from '@/env'
import {
  createGarminDiveClient,
  exchangeForDiveToken,
  GarminDiveApiError,
} from '../dive-api'
import { loadGarminTokens, saveGarminTokens } from './credentials.server'

export interface GarminDiveProbeStep {
  name: string
  ok: boolean
  detail: string
  /** Redacted payload excerpt, JSON-encoded for the server-function boundary. */
  sample?: string
}

export interface GarminDiveProbeResult {
  ranAt: string
  steps: GarminDiveProbeStep[]
}

function describeError(error: unknown) {
  if (error instanceof GarminDiveApiError)
    return `${error.status}: ${error.body.slice(0, 400)}`
  return error instanceof Error ? error.message : String(error)
}

/** Strips values that would identify the account or leak tokens. */
function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return '…'
  if (Array.isArray(value))
    return value.slice(0, 3).map((item) => redact(item, depth + 1))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
        key,
        /token|secret|url|serial|email|profile/i.test(key)
          ? typeof nested === 'string'
            ? `<${nested.length} chars>`
            : '<hidden>'
          : redact(nested, depth + 1),
      ]),
    )
  }
  return value
}

/**
 * Exercises the undocumented Garmin Dive API with the stored Connect tokens and
 * reports what each endpoint returned. Read-only; nothing is written to the
 * logbook. The Connect client refreshes an expired OAuth2 token as a side
 * effect, and that refreshed token is persisted like the FIT sync does.
 */
export async function probeGarminDiveApi(): Promise<GarminDiveProbeResult> {
  const steps: GarminDiveProbeStep[] = []
  const tokens = await loadGarminTokens()
  if (!tokens) {
    return {
      ranAt: new Date().toISOString(),
      steps: [
        {
          name: 'Load Connect tokens',
          ok: false,
          detail: 'No Garmin account is connected.',
        },
      ],
    }
  }

  const client = new GarminConnect(
    { username: '', password: '' },
    getServerEnv().GARMIN_DOMAIN,
  )
  client.loadToken(tokens.oauth1 as never, tokens.oauth2 as never)
  // Any request through the library validates the token and refreshes it when
  // expired; the profile call is the cheapest way to trigger that.
  try {
    await client.getUserProfile()
    const refreshed = client.exportToken()
    await saveGarminTokens({
      oauth1: refreshed.oauth1 as unknown as Record<string, unknown>,
      oauth2: refreshed.oauth2 as unknown as Record<string, unknown>,
    })
    steps.push({ name: 'Connect session', ok: true, detail: 'Connect token valid.' })
  } catch (error) {
    steps.push({ name: 'Connect session', ok: false, detail: describeError(error) })
    return { ranAt: new Date().toISOString(), steps }
  }

  const connectAccessToken = client.exportToken().oauth2.access_token
  if (typeof connectAccessToken !== 'string') {
    steps.push({
      name: 'Dive token exchange',
      ok: false,
      detail: 'Stored OAuth2 has no access_token.',
    })
    return { ranAt: new Date().toISOString(), steps }
  }

  let dive: ReturnType<typeof createGarminDiveClient>
  try {
    const diveToken = await exchangeForDiveToken(connectAccessToken)
    steps.push({
      name: 'Dive token exchange',
      ok: true,
      detail: `Scope: ${diveToken.scope ?? 'unknown'}; expires in ${
        diveToken.expiresAt
          ? Math.round((diveToken.expiresAt * 1_000 - Date.now()) / 60_000)
          : '?'
      } min; refresh token ${diveToken.refreshToken ? 'present' : 'absent'}.`,
    })
    dive = createGarminDiveClient(diveToken)
  } catch (error) {
    steps.push({ name: 'Dive token exchange', ok: false, detail: describeError(error) })
    return { ranAt: new Date().toISOString(), steps }
  }

  const attempt = async (
    name: string,
    run: () => Promise<{ detail: string; sample?: unknown }>,
  ) => {
    try {
      const { detail, sample } = await run()
      steps.push({
        name,
        ok: true,
        detail,
        ...(sample === undefined || sample === null
          ? {}
          : { sample: JSON.stringify(redact(sample), null, 2) }),
      })
    } catch (error) {
      steps.push({ name, ok: false, detail: describeError(error) })
    }
  }

  await attempt('Dive summary', async () => {
    const page = await dive.listDives(0, 5)
    const first = page.dives[0]
    return {
      detail: `${page.totalCount ?? '?'} dives in total; first page has ${page.dives.length}. Keys: ${Object.keys(page.raw).join(', ')}.`,
      sample: first
        ? {
            ...first.raw,
            fieldsMapped: {
              name: first.name,
              diveType: first.diveType,
              number: first.number,
              tags: first.diveTags,
              activitySource: first.activitySource,
              connectActivityId: first.connectActivityId,
              entryLoc: first.entryLoc,
            },
          }
        : null,
    }
  })

  await attempt('FIT download with the Dive token', async () => {
    const page = await dive.listDives(0, 5)
    const withActivity = page.dives.find((item) => item.connectActivityId !== null)
    if (!withActivity?.connectActivityId) {
      return { detail: 'No dive with a Connect activity to download.' }
    }
    const archive = await dive.downloadFitArchive(withActivity.connectActivityId)
    return {
      detail: `Downloaded ${archive.byteLength} bytes for activity ${withActivity.connectActivityId}.`,
    }
  })

  await attempt('Gear summary', async () => {
    const gear = await dive.listGear()
    const byType = gear.reduce<Record<string, number>>((counts, item) => {
      counts[item.type] = (counts[item.type] ?? 0) + 1
      return counts
    }, {})
    return {
      detail: `${gear.length} gear items: ${
        Object.entries(byType)
          .map(([type, count]) => `${type} ×${count}`)
          .join(', ') || 'none'
      }.`,
      sample: gear.slice(0, 3).map((item) => item.raw),
    }
  })

  await attempt('Gear detail', async () => {
    const gear = await dive.listGear()
    const target = gear.find((item) => item.type !== 'CERTIFICATION') ?? gear[0]
    if (!target) return { detail: 'No gear to inspect.' }
    const detail = await dive.getGear(target.gearId)
    return {
      detail: `${detail.type} “${detail.name}”: brand ${detail.brand ?? '—'}, model ${detail.model ?? '—'}, purchased ${detail.purchaseDate ?? '—'}, last service ${detail.lastServiceDate ?? '—'}, next ${detail.nextServiceDate ?? '—'}.`,
      sample: detail.raw,
    }
  })

  await attempt('Certifications', async () => {
    const certifications = (await dive.listGear()).filter(
      (item) => item.type === 'CERTIFICATION',
    )
    const details = await Promise.all(
      certifications.slice(0, 3).map((item) => dive.getGear(item.gearId)),
    )
    return {
      detail:
        certifications.length === 0
          ? 'No certifications logged in Garmin Dive.'
          : `${certifications.length} certification(s): ${certifications.map((c) => c.name).join(', ')}.`,
      sample: details.map((item) => item.raw),
    }
  })

  await attempt('Dive devices', async () => {
    const devices = await dive.listDevices()
    return {
      detail: `${devices.length} device(s): ${devices.map((d) => `${d.productDisplayName ?? '?'} (${d.type ?? '?'})`).join(', ') || 'none'}.`,
      sample: devices.map((d) => d.raw),
    }
  })

  await attempt('Dive tags', async () => {
    const tags = await dive.listTags()
    const used = Object.entries(tags).filter(([, count]) => count > 0)
    return {
      detail: `${Object.keys(tags).length} tag types, ${used.length} in use: ${used.map(([tag, count]) => `${tag} ×${count}`).join(', ') || 'none'}.`,
    }
  })

  return { ranAt: new Date().toISOString(), steps }
}
