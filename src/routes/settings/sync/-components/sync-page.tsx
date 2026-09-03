import { Link, useRouter } from '@tanstack/react-router'
import {
  CheckCircle2,
  CircleAlert,
  Database,
  Download,
  Link2,
  Link2Off,
  RefreshCw,
  ScrollText,
  ShieldAlert,
  UploadCloud,
} from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  loadDiveMateWriteBackStatus,
  runDiveMateWriteBack,
} from '@/modules/divemate/server/writeback'
import type { getGarminAccountStatus } from '@/modules/garmin/server/account'
import {
  completeGarminMfa,
  connectGarmin,
  disconnectGarmin,
} from '@/modules/garmin/server/account'
import type { getIntegrationStatus } from '@/modules/integrations/server/operations'
import {
  runFullImport,
  runIncrementalImport,
} from '@/modules/integrations/server/operations'

type Integrations = Awaited<ReturnType<typeof getIntegrationStatus>>
type Integration = Integrations[number]
type GarminAccount = Awaited<ReturnType<typeof getGarminAccountStatus>>

function GarminAccountSection({ account }: { account: GarminAccount }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaChallenge, setMfaChallenge] = useState<{
    challengeId: string
    expiresAt: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  if (!account.configured) return null

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const result = await connectGarmin({ data: { email, password } })
      if (result.mfaRequired) {
        setMfaChallenge({
          challengeId: result.challengeId,
          expiresAt: result.expiresAt,
        })
        setPassword('')
        setMessage('Garmin accepted your credentials. Enter the verification code.')
        return
      }
      setMessage(
        `Connected${result.displayName ? ` as ${result.displayName}` : ''}. Tokens are stored on the adapter; your password was not saved.`,
      )
      setEmail('')
      setPassword('')
      await router.invalidate()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Garmin account connection failed',
      )
    } finally {
      setBusy(false)
    }
  }

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!mfaChallenge) return
    setBusy(true)
    setMessage('')
    try {
      const result = await completeGarminMfa({
        data: {
          challengeId: mfaChallenge.challengeId,
          code: mfaCode,
        },
      })
      setMessage(
        `Connected${result.displayName ? ` as ${result.displayName}` : ''}. Tokens are stored on the adapter; your password and verification code were not saved.`,
      )
      setEmail('')
      setMfaCode('')
      setMfaChallenge(null)
      await router.invalidate()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Garmin verification failed')
    } finally {
      setBusy(false)
    }
  }

  async function disconnect() {
    if (
      !window.confirm(
        'Disconnect the Garmin account? The tokens stored on the adapter are deleted and scheduled imports will fail until an account is connected again.',
      )
    ) {
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await disconnectGarmin()
      setMessage('Garmin account disconnected.')
      await router.invalidate()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Garmin account disconnect failed',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-5 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">Garmin account</h3>
      {account.connected ? (
        <div className="mt-2 space-y-3">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link2 className="text-emerald-600" size={16} aria-hidden="true" />
            Connected
            {account.tokensSavedAt
              ? ` · tokens saved ${new Date(account.tokensSavedAt).toLocaleString()}`
              : ''}
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void disconnect()}
          >
            <Link2Off size={16} aria-hidden="true" />
            {busy ? 'Disconnecting…' : 'Disconnect account'}
          </Button>
        </div>
      ) : mfaChallenge ? (
        <form className="mt-2 space-y-3" onSubmit={(event) => void verifyMfa(event)}>
          <p className="text-sm leading-6 text-muted-foreground">
            Enter the verification code Garmin sent you. This challenge expires at{' '}
            {new Date(mfaChallenge.expiresAt).toLocaleTimeString()} and is discarded after
            three failed attempts.
          </p>
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Verification code"
            aria-label="Garmin verification code"
            value={mfaCode}
            onChange={(event) => setMfaCode(event.target.value)}
            required
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || !mfaCode.trim()}>
              <Link2 size={16} aria-hidden="true" />
              {busy ? 'Verifying…' : 'Verify and connect'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setMfaChallenge(null)
                setMfaCode('')
                setMessage('')
              }}
            >
              Start over
            </Button>
          </div>
        </form>
      ) : (
        <form className="mt-2 space-y-3" onSubmit={(event) => void connect(event)}>
          <p className="text-sm leading-6 text-muted-foreground">
            Sign in once with your Garmin Connect account. Only the resulting tokens are
            stored on the adapter. If Garmin requests multi-factor authentication, you
            will be prompted for the verification code next.
          </p>
          {account.error ? (
            <p className="text-sm text-amber-700">{account.error}</p>
          ) : null}
          <Input
            type="email"
            autoComplete="username"
            placeholder="Garmin Connect email"
            aria-label="Garmin Connect email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            aria-label="Garmin Connect password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <Button type="submit" disabled={busy || !email || !password}>
            <Link2 size={16} aria-hidden="true" />
            {busy ? 'Connecting…' : 'Connect account'}
          </Button>
        </form>
      )}
      {message ? <p className="mt-3 text-sm">{message}</p> : null}
    </div>
  )
}

function capabilitySummary(integration: Integration) {
  const capabilities = integration.descriptor.capabilities
  return [
    capabilities.fullImport ? 'full import' : null,
    capabilities.incrementalImport ? 'incremental import' : null,
    capabilities.export ? 'manual export' : 'no export',
  ]
    .filter(Boolean)
    .join(' · ')
}

export function SyncPage({
  integrations,
  garminAccount,
}: {
  integrations: Integrations
  garminAccount: GarminAccount
}) {
  const router = useRouter()
  const [running, setRunning] = useState<string | null>(null)
  const [messages, setMessages] = useState<Record<string, string>>({})

  async function incrementalImport(integration: Integration) {
    const key = integration.descriptor.key as 'divemate' | 'garmin'
    setRunning(`${key}:incremental`)
    setMessages((current) => ({ ...current, [key]: '' }))
    try {
      const result = await runIncrementalImport({ data: { integrationKey: key } })
      setMessages((current) => ({
        ...current,
        [key]: `${result.records.created} new, ${result.records.updated} changed, and ${result.records.skipped} unchanged source records.`,
      }))
      await router.invalidate()
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [key]: error instanceof Error ? error.message : 'Incremental import failed',
      }))
    } finally {
      setRunning(null)
    }
  }

  async function fullImport(integration: Integration) {
    const confirmation = window.prompt(
      `A full ${integration.descriptor.displayName} import replaces every canonical record that came from an integration. Locally created, unlinked records are preserved. Type REPLACE to continue.`,
    )
    if (confirmation !== 'REPLACE') return
    const key = integration.descriptor.key as 'divemate' | 'garmin'
    setRunning(`${key}:full`)
    setMessages((current) => ({ ...current, [key]: '' }))
    try {
      const result = await runFullImport({
        data: { integrationKey: key, confirmation: 'REPLACE' },
      })
      setMessages((current) => ({
        ...current,
        [key]: `Full replacement succeeded with ${result.records.discovered} source records.`,
      }))
      await router.invalidate()
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [key]: error instanceof Error ? error.message : 'Full import failed',
      }))
    } finally {
      setRunning(null)
    }
  }

  async function exportDiveMateToDrive() {
    if (
      !window.confirm(
        'Replace DiveMate.ddb in the configured Google Drive folder with a fresh export of the current canonical Divetracx logbook? This is a one-off manual action. Google Drive will retain the previous file revision.',
      )
    ) {
      return
    }

    const key = 'divemate'
    setRunning(`${key}:drive-export`)
    setMessages((current) => ({ ...current, [key]: '' }))
    try {
      let status = await runDiveMateWriteBack()
      const labels = {
        'reading-drive': 'Reading the DiveMate schema from Google Drive…',
        'reading-divetracx': 'Reading canonical Divetracx records…',
        'updating-database': 'Building the canonical DiveMate database…',
        'uploading-drive': 'Uploading DiveMate.ddb to Google Drive…',
      }
      while (status.state === 'running') {
        setMessages((current) => ({ ...current, [key]: labels[status.stage] }))
        await new Promise((resolve) => window.setTimeout(resolve, 1_000))
        const latest = await loadDiveMateWriteBackStatus()
        if (!latest || latest.id !== status.id) {
          throw new Error('DiveMate Drive export status was lost')
        }
        status = latest
      }
      if (status.state === 'failed') {
        throw new Error(status.error ?? 'DiveMate Drive export failed')
      }
      const result = status.result
      if (!result) {
        throw new Error('DiveMate Drive export finished without a result')
      }
      setMessages((current) => ({
        ...current,
        [key]: `Exported ${result.updatedRecords} canonical records to DiveMate.ddb. Google Drive retained the previous file revision.`,
      }))
    } catch (error) {
      setMessages((current) => ({
        ...current,
        [key]: error instanceof Error ? error.message : 'DiveMate Drive export failed',
      }))
    } finally {
      setRunning(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Settings
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
          External applications feed your canonical Divetracx logbook. Incremental imports
          are one-way and idempotent; exports are separate, explicit manual actions.
        </p>
        <Link
          to="/settings/sync/logs"
          className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ScrollText size={16} aria-hidden="true" /> View import history
        </Link>
      </header>

      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 shrink-0" size={21} aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Full import is destructive by design</h2>
            <p className="mt-1 text-sm leading-6">
              The source is validated before replacement starts, and the replacement is
              transactional. A failed full import leaves the valid canonical dataset in
              place.
            </p>
          </div>
        </div>
      </div>

      <section className="grid gap-5 lg:grid-cols-2" aria-label="Available integrations">
        {integrations.map((integration) => {
          const key = integration.descriptor.key
          const incrementalRunning = running === `${key}:incremental`
          const fullRunning = running === `${key}:full`
          const driveExportRunning = running === `${key}:drive-export`
          return (
            <article key={key} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Database size={20} aria-hidden="true" />
                </span>
                {integration.latestRun?.status === 'failed' ? (
                  <CircleAlert className="text-red-600" size={21} aria-label="Failed" />
                ) : integration.latestRun ? (
                  <CheckCircle2
                    className="text-emerald-600"
                    size={21}
                    aria-label="Run recorded"
                  />
                ) : null}
              </div>
              <h2 className="mt-5 text-xl font-semibold">
                {integration.descriptor.displayName}
              </h2>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {capabilitySummary(integration)}
              </p>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {integration.configurationHint}
              </p>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Entities: {integration.descriptor.supportedEntities.join(', ')}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  type="button"
                  disabled={!integration.configured.incrementalImport || running !== null}
                  onClick={() => void incrementalImport(integration)}
                >
                  <RefreshCw
                    className={incrementalRunning ? 'animate-spin' : ''}
                    size={16}
                    aria-hidden="true"
                  />
                  {incrementalRunning ? 'Importing…' : 'Incremental import'}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!integration.configured.fullImport || running !== null}
                  onClick={() => void fullImport(integration)}
                >
                  <ShieldAlert size={16} aria-hidden="true" />
                  {fullRunning ? 'Replacing…' : 'Full import'}
                </Button>
                {integration.descriptor.capabilities.export ? (
                  <a
                    href={`/api/export/${key}`}
                    download
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-2 text-sm font-semibold hover:bg-muted"
                  >
                    <Download size={16} aria-hidden="true" /> Export
                  </a>
                ) : null}
                {key === 'divemate' && integration.descriptor.capabilities.export ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!integration.configured.export || running !== null}
                    onClick={() => void exportDiveMateToDrive()}
                  >
                    <UploadCloud
                      className={driveExportRunning ? 'animate-pulse' : ''}
                      size={16}
                      aria-hidden="true"
                    />
                    {driveExportRunning ? 'Exporting to Drive…' : 'Export to Drive'}
                  </Button>
                ) : null}
              </div>

              {!integration.configured.fullImport &&
              !integration.configured.incrementalImport ? (
                <p className="mt-4 text-sm text-amber-700">
                  Not configured on this server.
                </p>
              ) : null}
              {messages[key] ? <p className="mt-4 text-sm">{messages[key]}</p> : null}
              {key === 'garmin' ? <GarminAccountSection account={garminAccount} /> : null}
              <div className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
                {integration.latestRun
                  ? `${integration.latestRun.mode} import · ${integration.latestRun.status} · ${integration.latestRun.startedAt.toLocaleString()}`
                  : 'No import has run yet.'}
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}
