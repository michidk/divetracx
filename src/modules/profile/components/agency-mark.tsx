import { cn } from '@/lib/utils'
import {
  agencyDisplayName,
  agencyInitials,
  findAgency,
} from '@/modules/profile/agency-catalog'

export function AgencyMark({
  agencyCode,
  customAgencyName,
  className,
}: {
  agencyCode: string
  customAgencyName: string | null
  className?: string
}) {
  const agency = findAgency(agencyCode)
  const displayName = agencyDisplayName({ agencyCode, customAgencyName })

  return (
    <div
      className={cn(
        'relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-muted font-mono text-sm font-semibold text-primary ring-1 ring-border',
        className,
      )}
      role="img"
      aria-label={`${displayName} logo`}
    >
      <span aria-hidden="true">{agencyInitials(displayName)}</span>
      {agency ? (
        <img
          src={agency.logoSrc}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(event) => event.currentTarget.classList.add('hidden')}
        />
      ) : null}
    </div>
  )
}
