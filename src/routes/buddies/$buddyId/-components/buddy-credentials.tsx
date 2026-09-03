import { Link } from '@tanstack/react-router'
import { Award, BadgeCheck, Pencil, Plus } from 'lucide-react'
import type { getBuddy } from '@/modules/buddies/server/queries'
import { AgencyMark } from '@/modules/profile/components/agency-mark'

type BuddyDetail = NonNullable<Awaited<ReturnType<typeof getBuddy>>>

export function BuddyCredentials({
  buddyId,
  certifications,
  memberships,
}: {
  buddyId: string
  certifications: BuddyDetail['certifications']
  memberships: BuddyDetail['agencyMemberships']
}) {
  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Certifications
          </h2>
          <Link
            to="/buddies/$buddyId/certifications/$buddyCertificationId"
            params={{ buddyId, buddyCertificationId: 'new' }}
            className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <Plus size={15} aria-hidden="true" /> Add certification
          </Link>
        </div>
        {certifications.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No certifications recorded for this buddy.
          </p>
        ) : (
          <ul className="space-y-3">
            {certifications.map((certification) => (
              <li key={certification.id}>
                <article className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                  <AgencyMark agency={certification.agency} className="size-11" />
                  <Award size={18} className="shrink-0 text-primary" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{certification.name}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {certification.agency.name}
                    </p>
                  </div>
                  <Link
                    to="/buddies/$buddyId/certifications/$buddyCertificationId"
                    params={{ buddyId, buddyCertificationId: certification.id }}
                    aria-label={`Edit ${certification.name}`}
                    className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Agency memberships
          </h2>
          <Link
            to="/buddies/$buddyId/agencies/$buddyAgencyMembershipId"
            params={{ buddyId, buddyAgencyMembershipId: 'new' }}
            className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <Plus size={15} aria-hidden="true" /> Add agency
          </Link>
        </div>
        {memberships.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No agency numbers recorded for this buddy.
          </p>
        ) : (
          <ul className="space-y-3">
            {memberships.map((membership) => (
              <li key={membership.id}>
                <article className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                  <AgencyMark agency={membership.agency} className="size-11" />
                  <BadgeCheck
                    size={18}
                    className="shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{membership.agency.name}</p>
                    <p className="truncate font-mono text-sm text-muted-foreground">
                      {membership.memberNumber}
                    </p>
                  </div>
                  <Link
                    to="/buddies/$buddyId/agencies/$buddyAgencyMembershipId"
                    params={{ buddyId, buddyAgencyMembershipId: membership.id }}
                    aria-label={`Edit ${membership.agency.name} membership`}
                    className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
