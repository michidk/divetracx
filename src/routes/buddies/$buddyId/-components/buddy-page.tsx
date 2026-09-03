import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Waves } from 'lucide-react'
import { DeleteRecordButton } from '@/components/delete-record-button'
import { DiveLinkList } from '@/components/dive-link-list'
import { EntityForm } from '@/components/entity-form'
import { Badge } from '@/components/ui/badge'
import type { getBuddy } from '@/modules/buddies/server/queries'
import { formatDiveDate, formatPersonName } from '@/modules/dives/format'
import { BuddyCredentials } from './buddy-credentials'

type BuddyDetail = NonNullable<Awaited<ReturnType<typeof getBuddy>>>

export function BuddyPage({ detail }: { detail: BuddyDetail }) {
  const navigate = useNavigate()
  const { buddy, dives } = detail
  const lastDive = dives[0]

  return (
    <div className="space-y-7">
      <header>
        <Link
          to="/buddies"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> All buddies
        </Link>
        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          {formatPersonName(buddy)}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {[buddy.city, buddy.country].filter(Boolean).join(', ') ||
            buddy.email ||
            'No contact details yet'}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {buddy.instructor ? (
            <Badge variant="accent" className="rounded-lg px-2.5 py-1">
              Instructor
            </Badge>
          ) : null}
          <Badge variant="secondary" className="rounded-lg px-2.5 py-1">
            <Waves size={13} aria-hidden="true" /> {dives.length}{' '}
            {dives.length === 1 ? 'dive together' : 'dives together'}
          </Badge>
          {buddy.minimumDives !== null ? (
            <Badge variant="secondary" className="rounded-lg px-2.5 py-1">
              At least {buddy.minimumDives.toLocaleString()} total dives
            </Badge>
          ) : null}
          {lastDive ? (
            <Badge variant="accent" className="rounded-lg px-2.5 py-1">
              Last {formatDiveDate(lastDive.diveDate, 'medium')}
            </Badge>
          ) : null}
        </div>
      </header>

      <BuddyCredentials
        buddyId={buddy.id}
        certifications={detail.certifications}
        memberships={detail.agencyMemberships}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)]">
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <h2 className="border-b border-border px-5 py-4 font-semibold">
            Dives together
          </h2>
          <DiveLinkList dives={dives} emptyText="No shared dives yet." />
        </section>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Buddy details
          </h2>
          <EntityForm entity="buddies" recordId={buddy.id} record={buddy} />
          <div className="mt-4">
            <DeleteRecordButton
              entity="buddies"
              recordId={buddy.id}
              label="Delete buddy"
              confirmText={`Delete ${formatPersonName(buddy)}? They will be removed from ${dives.length} dives. A future full import may restore them.`}
              onDeleted={() => navigate({ to: '/buddies' })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
