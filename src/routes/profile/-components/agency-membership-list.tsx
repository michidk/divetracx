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
            <article className="relative flex min-h-32 h-full items-end gap-4 overflow-hidden rounded-2xl border border-black/10 bg-card p-4 shadow-lg">
              <AgencyMark
                agency={membership.agency}
                decorative
                className="absolute inset-0 size-full rounded-none bg-gradient-to-br from-primary to-cyan-900 text-6xl text-white/20 ring-0"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/40" />
              <div className="relative min-w-0 flex-1 text-white">
                <p className="truncate font-semibold">{displayName}</p>
                {membership.agency.fullName ? (
                  <p className="mt-0.5 truncate text-xs text-white/75">
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
                className="relative shrink-0 rounded-lg p-2 text-white/75 transition hover:bg-white/15 hover:text-white"
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
