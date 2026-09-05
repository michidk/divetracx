import { useNavigate, useRouter } from '@tanstack/react-router'
import { AlertTriangle, Combine, Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import { diveTypeIcon } from '@/components/dive-type-icon'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { formatDiveDate, formatDuration, formatMeters } from '@/modules/dives/format'
import type { getMergeCandidates, getMergePreview } from '@/modules/dives/server/merge'
import { getMergePreview as loadPreview, mergeDives } from '@/modules/dives/server/merge'

type Candidates = NonNullable<Awaited<ReturnType<typeof getMergeCandidates>>>
type Preview = Awaited<ReturnType<typeof getMergePreview>>

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-mono text-sm font-medium">{value}</dd>
    </div>
  )
}

export function MergePage({
  diveId,
  candidates,
}: {
  diveId: string
  candidates: Candidates['candidates']
}) {
  const router = useRouter()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [merging, setMerging] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // The preview is computed by the same code that carries the merge out, so
  // what the review shows cannot drift from what happens.
  useEffect(() => {
    if (selected.length === 0) {
      setPreview(null)
      return
    }
    let current = true
    setLoading(true)
    loadPreview({ data: { diveId, sourceDiveIds: selected } })
      .then((result) => {
        if (current) setPreview(result)
      })
      .catch((error: unknown) => {
        if (current) {
          setMessage(error instanceof Error ? error.message : 'The preview failed')
        }
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [diveId, selected])

  function toggle(candidateId: string) {
    setMessage(null)
    setSelected((current) =>
      current.includes(candidateId)
        ? current.filter((id) => id !== candidateId)
        : [...current, candidateId],
    )
  }

  async function run() {
    if (!preview || preview.error) return
    const removed = preview.segments
      .filter((segment) => !segment.isKeeper)
      .map((segment) => segment.label)
      .join('\n')
    if (
      !window.confirm(
        `Keep ${preview.keeperLabel}\n\nand delete:\n${removed}\n\n` +
          'Their profiles, tanks, buddies, gear and photos move across. This ' +
          'cannot be undone.',
      )
    ) {
      return
    }
    setMerging(true)
    setMessage(null)
    try {
      // The dive that survives is the earliest, which may not be this one.
      const result = await mergeDives({ data: { diveId, sourceDiveIds: selected } })
      await router.invalidate()
      await navigate({ to: '/dives/$diveId', params: { diveId: result.diveId } })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The merge failed')
      setMerging(false)
    }
  }

  if (candidates.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center">
        <p className="font-medium">No dive is close enough in time to merge.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Only dives logged within a day of this one can be part of the same dive.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <h2 className="border-b border-border bg-muted/50 px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Dives within a day
        </h2>
        {candidates.map((candidate) => {
          const TypeIcon = diveTypeIcon(candidate.diveTypeName)
          const checked = selected.includes(candidate.id)
          return (
            <div
              key={candidate.id}
              className="grid min-h-16 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-border px-5 py-3 transition-colors last:border-0 hover:bg-muted/50 has-[:focus-visible]:bg-muted/50"
            >
              <Checkbox
                id={`merge-${candidate.id}`}
                checked={checked}
                onCheckedChange={() => toggle(candidate.id)}
                disabled={merging}
              />
              <span
                title={candidate.diveTypeName ?? undefined}
                className="grid size-9 place-items-center rounded-lg bg-accent text-primary"
              >
                <TypeIcon size={16} aria-hidden="true" />
                <span className="sr-only">{candidate.diveTypeName ?? 'Dive'}</span>
              </span>
              <label htmlFor={`merge-${candidate.id}`} className="min-w-0 cursor-pointer">
                <span className="block truncate font-medium">
                  {candidate.siteName ?? `Dive #${candidate.number ?? '—'}`}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  #{candidate.number ?? '—'} ·{' '}
                  {formatDiveDate(candidate.diveDate, 'medium')}
                  {candidate.entryTime ? ` · ${candidate.entryTime.slice(0, 5)}` : ''} ·{' '}
                  {candidate.sampleCount > 0
                    ? `${candidate.sampleCount.toLocaleString()} samples`
                    : 'no profile'}
                </span>
              </label>
              <span className="text-right font-mono text-sm text-muted-foreground">
                <span className="block">{formatDuration(candidate.durationSeconds)}</span>
                <span className="block text-xs">
                  {formatMeters(candidate.maximumDepthMeters)}
                </span>
              </span>
            </div>
          )
        })}
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-6">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Result
        </h2>

        {selected.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Select the dives that belong to this one.
          </p>
        ) : loading || !preview ? (
          <p className="text-sm text-muted-foreground">Working out the result…</p>
        ) : preview.error ? (
          <p className="flex gap-2 text-sm text-red-600">
            <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
            {preview.error}
          </p>
        ) : (
          <>
            {preview.keeperDiveId !== diveId ? (
              <p className="flex gap-2 rounded-lg bg-warning/10 p-3 text-xs text-warning-foreground">
                <Info size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
                The dive began earlier than this one, so {preview.keeperLabel} is the
                entry that is kept — this one is merged into it and deleted.
              </p>
            ) : null}
            <ol className="space-y-2">
              {preview.segments.map((segment) => (
                <li key={segment.diveId}>
                  {segment.gapSeconds > 0 ? (
                    <p className="py-1 pl-3 text-xs text-muted-foreground">
                      ↕ {formatDuration(segment.gapSeconds)} at the surface
                    </p>
                  ) : null}
                  <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                    {segment.label}
                    {segment.isKeeper ? (
                      <span className="ml-2 text-xs font-semibold text-primary">
                        kept
                      </span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ol>

            <dl className="space-y-2 border-t border-border pt-4">
              <Row label="Duration" value={formatDuration(preview.durationSeconds)} />
              <Row
                label="Maximum depth"
                value={formatMeters(preview.maximumDepthMeters)}
              />
              <Row
                label="Average depth"
                value={formatMeters(preview.averageDepthMeters)}
              />
              <Row
                label="Profile samples"
                value={`+${preview.samplesMoved.toLocaleString()}`}
              />
              <Row
                label="Tanks"
                value={
                  preview.tanksCombined + preview.tanksAppended === 0
                    ? '—'
                    : `${preview.tanksCombined} continued, ${preview.tanksAppended} added`
                }
              />
              {preview.photosMoved > 0 ? (
                <Row label="Photos moved" value={preview.photosMoved} />
              ) : null}
            </dl>

            {preview.tanksBeyondChartSlots > 0 ? (
              <p className="flex gap-2 rounded-lg bg-warning/10 p-3 text-xs text-warning-foreground">
                <Info size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
                {preview.tanksBeyondChartSlots === 1
                  ? 'One tank keeps'
                  : 'Some tanks keep'}{' '}
                its recorded pressures but gets no series on the profile chart, which
                plots two tanks.
              </p>
            ) : null}
          </>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button
            type="button"
            onClick={() => void run()}
            disabled={merging || loading || !preview || Boolean(preview.error)}
          >
            <Combine size={15} aria-hidden="true" />
            {merging ? 'Merging…' : 'Merge dives'}
          </Button>
        </div>

        {message ? (
          <p aria-live="polite" className="text-sm text-red-600">
            {message}
          </p>
        ) : null}
      </section>
    </div>
  )
}
