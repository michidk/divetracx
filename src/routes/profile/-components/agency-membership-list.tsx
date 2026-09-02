import { Link } from '@tanstack/react-router'
import { Pencil } from 'lucide-react'
import { AgencyMark } from '@/modules/profile/components/agency-mark'
import type { getProfile } from '@/modules/profile/server/queries'

type AgencyMembership = Awaited<
  ReturnType<typeof getProfile>
>['agencyMemberships'][number]

export function AgencyMembershipList({
  memberships,
}: {
  memberships: AgencyMembership[]
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {memberships.map((membership) => {
        const displayName = membership.agency.name
        return (
          <li key={membership.id}>
            <article className="flex h-full items-center gap-4 rounded-2xl border border-border bg-card p-4">
              <AgencyMark agency={membership.agency} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{displayName}</p>
                {membership.agency.fullName ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {membership.agency.fullName}
                  </p>
                ) : null}
                <p className="mt-2 font-mono text-sm tracking-wide">
                  {membership.memberNumber}
                </p>
              </div>
              <Link
                to="/profile/agencies/$agencyMembershipId"
                params={{ agencyMembershipId: membership.id }}
                aria-label={`Edit ${displayName} membership`}
                className="shrink-0 rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Pencil size={15} aria-hidden="true" />
              </Link>
            </article>
          </li>
        )
      })}
    </ul>
  )
}
