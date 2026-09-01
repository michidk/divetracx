import { Link, useRouter } from '@tanstack/react-router'
import { CheckCircle2, Database, RefreshCw, ScrollText, UploadCloud } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { getDiveMateSyncStatus } from '@/modules/divemate/server/status'
import { runDiveMateSync } from '@/modules/divemate/server/sync'
import { runDiveMateWriteBack } from '@/modules/divemate/server/writeback'

type SyncStatus = Awaited<ReturnType<typeof getDiveMateSyncStatus>>

export function SyncPage({ status }: { status: SyncStatus }) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function synchronize() {
    setSyncing(true)
    setMessage(null)
    try {
      const result = await runDiveMateSync()
      setMessage(
        `Imported ${result.counts.dives ?? 0} dives, ${result.counts.profileSamples ?? 0} profile samples, and ${result.counts.pictures ?? 0} pictures successfully.`,
      )
      await router.invalidate()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'DiveMate sync failed')
    } finally {
      setSyncing(false)
    }
  }

  async function pushToDrive() {
    if (
      !window.confirm('Update DiveMate.ddb in Google Drive with current Divetracx edits?')
    )
      return
    setPushing(true)
    setMessage(null)
    try {
      const result = await runDiveMateWriteBack()
      setMessage(
        `Updated ${result.updatedRecords} imported DiveMate records. Google Drive retained the previous database revision.`,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Drive write-back failed')
    } finally {
      setPushing(false)
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
        <Link
          to="/settings/sync/logs"
          className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ScrollText size={16} aria-hidden="true" /> View sync logs
        </Link>
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
                ? 'A server-side DiveMate backup source is configured. Its credentials are never sent to the browser.'
                : 'Set DIVEMATE_GOOGLE_DRIVE_FOLDER_ID and service-account credentials before synchronizing.'}
            </p>
            <Button
              type="button"
              disabled={!status.configured || syncing}
              onClick={() => void synchronize()}
              className="mt-6"
            >
              <RefreshCw
                className={syncing ? 'animate-spin' : ''}
                size={16}
                aria-hidden="true"
              />
              {syncing ? 'Synchronizing…' : 'Sync now'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!status.configured || syncing || pushing}
              onClick={() => void pushToDrive()}
              className="mt-6 ml-3"
            >
              <UploadCloud
                className={pushing ? 'animate-pulse' : ''}
                size={16}
                aria-hidden="true"
              />
              {pushing ? 'Pushing…' : 'Push edits to Drive'}
            </Button>
            {message ? <p className="mt-4 text-sm">{message}</p> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6">
          <UploadCloud className="text-primary" size={22} aria-hidden="true" />
          <h2 className="mt-5 font-semibold">Manual write-back</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Automatic sync is import-only. Manual write-back updates existing imported
            records and retains the previous Google Drive file revision.
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
