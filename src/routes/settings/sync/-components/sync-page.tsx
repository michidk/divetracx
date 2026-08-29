import { useRouter } from '@tanstack/react-router'
import { CheckCircle2, Database, RefreshCw, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import type { getDiveMateSyncStatus } from '@/modules/divemate/server/status'
import { runDiveMateSync } from '@/modules/divemate/server/sync'

type SyncStatus = Awaited<ReturnType<typeof getDiveMateSyncStatus>>

export function SyncPage({ status }: { status: SyncStatus }) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function synchronize() {
    setSyncing(true)
    setMessage(null)
    try {
      const result = await runDiveMateSync()
      setMessage(`Imported ${result.counts.dives ?? 0} dives successfully.`)
      await router.invalidate()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'DiveMate sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Settings
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">DiveMate sync</h1>
        <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
          Import your DiveMate SQLite backup into PostgreSQL. Existing source records are
          updated and missing records are retained.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Database size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Configured backup</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {status.configured
                ? 'A server-side DIVEMATE_BACKUP_URL is configured. Its value is never sent to the browser.'
                : 'Set DIVEMATE_BACKUP_URL in the server environment before synchronizing.'}
            </p>
            <button
              type="button"
              disabled={!status.configured || syncing}
              onClick={() => void synchronize()}
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={syncing ? 'animate-spin' : ''}
                size={16}
                aria-hidden="true"
              />
              {syncing ? 'Synchronizing…' : 'Sync now'}
            </button>
            {message ? <p className="mt-4 text-sm">{message}</p> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <ShieldCheck className="text-primary" size={22} aria-hidden="true" />
          <h2 className="mt-5 font-semibold">Read-only source</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Divetracx never changes the `.ddb` file. The downloaded copy is removed after
            each attempt.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <CheckCircle2 className="text-primary" size={22} aria-hidden="true" />
          <h2 className="mt-5 font-semibold">Latest run</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {status.latestRun
              ? `${status.latestRun.status} · ${status.latestRun.startedAt.toLocaleString()}`
              : 'No synchronization has run yet.'}
          </p>
          {status.latestRun?.error ? (
            <p className="mt-2 text-sm text-red-600">{status.latestRun.error}</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}
