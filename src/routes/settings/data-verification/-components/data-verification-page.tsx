import { Link, useRouter } from '@tanstack/react-router'
import {
  ArrowLeft,
  CheckCircle2,
  Combine,
  Copy,
  ListOrdered,
  TriangleAlert,
} from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatDiveDate, formatDuration, formatMeters } from '@/modules/dives/format'
import type { getDataVerificationStatus } from '@/modules/dives/server/maintenance'
import { renumberDives } from '@/modules/dives/server/maintenance'
import type { VerificationDive } from '@/modules/dives/verification'

type Status = Awaited<ReturnType<typeof getDataVerificationStatus>>

function DiveIdentity({ dive }: { dive: VerificationDive }) {
  return (
    <div className="min-w-0">
      <Link
        to="/dives/$diveId"
        params={{ diveId: dive.id }}
        className="block truncate font-medium text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {dive.siteName ?? `Dive #${dive.number ?? '—'}`}
      </Link>
      <p className="mt-1 text-xs text-muted-foreground">
        <span className="font-mono">#{dive.number ?? '—'}</span> ·{' '}
        {formatDiveDate(dive.diveDate, 'medium')}
        {dive.entryTime ? ` · ${dive.entryTime.slice(0, 5)}` : ' · time missing'}
      </p>
      <p className="mt-1 font-mono text-xs text-muted-foreground">
        {formatDuration(dive.durationSeconds)} · {formatMeters(dive.maximumDepthMeters)} ·{' '}
        {dive.captureSource}
      </p>
    </div>
  )
}

function NumberingCheck({ status }: { status: Status['numbering'] }) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const clean = status.wouldChange === 0

  async function run() {
    if (
      !window.confirm(
        `Renumber all ${status.totalDives} dives chronologically to 1–${status.totalDives}? ` +
          `${status.wouldChange} dives will get a new number. The new numbers are included in future exports.`,
      )
    ) {
      return
    }
    setRunning(true)
    setMessage(null)
    try {
      const result = await renumberDives()
      await router.invalidate()
      setMessage(`Renumbered ${result.changed} dives.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Renumbering failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ListOrdered className="text-primary" size={22} aria-hidden="true" />
            <CardTitle>Dive numbering</CardTitle>
          </div>
          <Badge variant={clean ? 'accent' : 'warning'}>
            {clean ? 'Passed' : `${status.wouldChange} to review`}
          </Badge>
        </div>
        <CardDescription className="leading-6">
          Checks for missing, repeated, and non-chronological dive numbers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {clean ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle2
              className="mt-0.5 shrink-0 text-primary"
              size={17}
              aria-hidden="true"
            />
            All {status.totalDives.toLocaleString()} dives are numbered 1–
            {status.totalDives.toLocaleString()} in chronological order.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="font-mono text-2xl font-semibold">{status.wouldChange}</p>
              <p className="mt-1 text-xs text-muted-foreground">out of sequence</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="font-mono text-2xl font-semibold">{status.unnumberedDives}</p>
              <p className="mt-1 text-xs text-muted-foreground">without a number</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="font-mono text-2xl font-semibold">
                {status.duplicateNumbers}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                numbers used more than once
              </p>
            </div>
          </div>
        )}

        {status.duplicateGroups.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {status.duplicateGroups.map((group) => (
              <div key={group.number} className="rounded-xl border border-border p-4">
                <p className="mb-2 font-mono text-xs font-semibold text-muted-foreground">
                  Dive #{group.number} is used by
                </p>
                <ul className="space-y-2">
                  {group.dives.map((dive) => (
                    <li key={dive.id}>
                      <Link
                        to="/dives/$diveId"
                        params={{ diveId: dive.id }}
                        className="block truncate text-sm font-medium text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {dive.siteName ?? 'Unknown site'} ·{' '}
                        {formatDiveDate(dive.diveDate, 'medium')}
                        {dive.entryTime ? ` · ${dive.entryTime.slice(0, 5)}` : ''}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-5">
          <Button
            type="button"
            variant="outline"
            disabled={clean || running}
            onClick={() => void run()}
          >
            {running ? 'Renumbering…' : 'Renumber dives by date'}
          </Button>
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {message}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function DuplicateCheck({ candidates }: { candidates: Status['duplicateCandidates'] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Copy className="text-primary" size={22} aria-hidden="true" />
            <CardTitle>Duplicate entries</CardTitle>
          </div>
          <Badge variant={candidates.length === 0 ? 'accent' : 'warning'}>
            {candidates.length === 0
              ? 'Passed'
              : `${candidates.length} ${candidates.length === 1 ? 'pair' : 'pairs'} to review`}
          </Badge>
        </div>
        <CardDescription className="leading-6">
          Compares same-day start times, sites, durations, and depths. These are
          suggestions, not confirmed duplicates.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {candidates.length === 0 ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle2
              className="mt-0.5 shrink-0 text-primary"
              size={17}
              aria-hidden="true"
            />
            No likely duplicate dive entries found.
          </p>
        ) : (
          <div className="space-y-4">
            {candidates.map((candidate) => {
              const [left, right] = candidate.dives
              return (
                <article
                  key={`${left.id}-${right.id}`}
                  className="rounded-xl border border-border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Badge
                        variant={
                          candidate.confidence === 'likely' ? 'warning' : 'secondary'
                        }
                      >
                        {candidate.confidence === 'likely'
                          ? 'Likely duplicate'
                          : 'Possible duplicate'}
                      </Badge>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {candidate.reasons.join(' · ')}
                      </p>
                    </div>
                    <Link
                      to="/dives/$diveId/merge"
                      params={{ diveId: left.id }}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Combine size={16} aria-hidden="true" /> Review merge
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-muted/40 p-4">
                      <DiveIdentity dive={left} />
                    </div>
                    <div className="rounded-xl bg-muted/40 p-4">
                      <DiveIdentity dive={right} />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function DataVerificationPage({ status }: { status: Status }) {
  const issueCount = status.numbering.wouldChange + status.duplicateCandidates.length
  return (
    <div className="space-y-7">
      <header>
        <Link
          to="/settings"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to settings
        </Link>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Logbook health
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Data verification</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Check the consistency of your logbook and review records that may need
          attention.
          {issueCount === 0
            ? ' Everything looks consistent.'
            : ` ${issueCount} items need review.`}
        </p>
      </header>
      {issueCount > 0 ? (
        <div className="flex gap-3 rounded-xl bg-warning/10 p-4 text-sm text-warning-foreground">
          <TriangleAlert className="mt-0.5 shrink-0" size={18} aria-hidden="true" />
          Verification only flags suspicious data. Open the affected dives before changing
          or merging them.
        </div>
      ) : null}
      <NumberingCheck status={status.numbering} />
      <DuplicateCheck candidates={status.duplicateCandidates} />
    </div>
  )
}
