import { Link, useRouter } from '@tanstack/react-router'
import {
  CheckCircle2,
  CircleAlert,
  Database,
  Download,
  RefreshCw,
  ScrollText,
  ShieldAlert,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { getIntegrationStatus } from '@/modules/integrations/server/operations'
import {
  runFullImport,
  runIncrementalImport,
} from '@/modules/integrations/server/operations'

type Integrations = Awaited<ReturnType<typeof getIntegrationStatus>>
type Integration = Integrations[number]

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

export function SyncPage({ integrations }: { integrations: Integrations }) {
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

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Settings
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
          External applications feed your canonical Divetracx logbook. Incremental imports
          are one-way and idempotent; exports are separate manual downloads.
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
              </div>

              {!integration.configured.fullImport &&
              !integration.configured.incrementalImport ? (
                <p className="mt-4 text-sm text-amber-700">
                  Not configured on this server.
                </p>
              ) : null}
              {messages[key] ? <p className="mt-4 text-sm">{messages[key]}</p> : null}
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
