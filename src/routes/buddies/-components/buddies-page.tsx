import { Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { getBuddies } from '@/modules/buddies/server/queries'
import { formatDiveDate, formatPersonName } from '@/modules/dives/format'

type BuddiesData = Awaited<ReturnType<typeof getBuddies>>

function initials(buddy: BuddiesData[number]) {
  const letters = [buddy.firstName, buddy.lastName]
    .map((name) => name?.trim().charAt(0) ?? '')
    .join('')
  return letters.toUpperCase() || '?'
}

export function BuddiesPage({ buddies }: { buddies: BuddiesData }) {
  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            People
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Buddies</h1>
          <p className="mt-3 text-muted-foreground">
            The {buddies.length} people in your dives and training history.
          </p>
        </div>
        <Link
          to="/buddies/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20"
        >
          <Plus size={16} aria-hidden="true" /> Add buddy
        </Link>
      </header>

      {buddies.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No buddies yet. Add a person here, then link them to dives or certifications.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {buddies.map((buddy) => (
            <Link
              key={buddy.id}
              to="/buddies/$buddyId"
              params={{ buddyId: buddy.id }}
              className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex items-center gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-accent font-semibold text-primary">
                  {initials(buddy)}
                </span>
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-semibold">
                      {formatPersonName(buddy)}
                    </span>
                    {buddy.instructor ? (
                      <Badge variant="accent" className="shrink-0 rounded-lg px-2 py-0.5">
                        Instructor
                      </Badge>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {[buddy.city, buddy.country].filter(Boolean).join(', ') ||
                      buddy.email ||
                      '—'}
                  </span>
                </span>
              </div>
              <dl className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Dives together
                  </dt>
                  <dd className="mt-0.5 font-mono font-semibold">{buddy.diveCount}</dd>
                </div>
                <div className="text-right">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Last dive
                  </dt>
                  <dd className="mt-0.5 font-medium">
                    {buddy.lastDiveDate
                      ? formatDiveDate(buddy.lastDiveDate, 'medium')
                      : '—'}
                  </dd>
                </div>
              </dl>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
