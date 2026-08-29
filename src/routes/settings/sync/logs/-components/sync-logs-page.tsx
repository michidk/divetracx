import { Link } from '@tanstack/react-router'
import { ArrowLeft, CheckCircle2, CircleAlert, Clock3, LoaderCircle } from 'lucide-react'
import type { getDiveMateSyncLogs } from '@/modules/divemate/server/logs'

type SyncLogs = Awaited<ReturnType<typeof getDiveMateSyncLogs>>
type SyncLog = SyncLogs[number]

function statusIcon(status: SyncLog['status']) {
  if (status === 'succeeded') {
    return <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />
  }
  if (status === 'failed') {
    return <CircleAlert size={18} className="text-red-600" aria-hidden="true" />
  }
  return (
    <LoaderCircle size={18} className="animate-spin text-primary" aria-hidden="true" />
  )
}

function duration(log: SyncLog) {
  if (!log.finishedAt) return 'Running'
  const milliseconds = log.finishedAt.getTime() - log.startedAt.getTime()
  if (milliseconds < 1000) return `${milliseconds} ms`
  return `${(milliseconds / 1000).toFixed(1)} s`
}

function importedSummary(counts: Record<string, number> | null) {
  if (!counts) return 'No import counts recorded'
  const preferredKeys = [
    'dives',
    'sites',
    'buddies',
    'equipment',
    'certifications',
    'tanks',
  ]
  return preferredKeys
    .filter((key) => counts[key] !== undefined)
    .map((key) => `${counts[key]} ${key}`)
    .join(' · ')
}

export function SyncLogsPage({ logs }: { logs: SyncLogs }) {
  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <header>
        <Link
          to="/settings/sync"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Manual sync
        </Link>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-primary">
          DiveMate
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Sync logs</h1>
        <p className="mt-3 text-muted-foreground">
          The latest 50 manual, scheduled, and command-line synchronization attempts.
        </p>
      </header>

      <section className="space-y-3" aria-label="Synchronization history">
        {logs.map((log) => (
          <article
            key={log.id}
            className="rounded-2xl border border-border bg-card p-5 md:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5">{statusIcon(log.status)}</span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold capitalize">{log.status}</h2>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {log.trigger}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {log.startedAt.toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                <Clock3 size={14} aria-hidden="true" /> {duration(log)}
              </p>
            </div>

            <p className="mt-5 text-sm text-muted-foreground">
              {importedSummary(log.counts)}
            </p>
            {log.sourceFingerprint ? (
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                backup {log.sourceFingerprint.slice(0, 16)}
              </p>
            ) : null}
            {log.error ? (
              <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-xl bg-red-50 p-4 text-xs text-red-800">
                {log.error}
              </pre>
            ) : null}
          </article>
        ))}
        {logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No synchronization attempts have been recorded.
          </div>
        ) : null}
      </section>
    </div>
  )
}
