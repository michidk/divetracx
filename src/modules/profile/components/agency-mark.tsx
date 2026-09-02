import { cn } from '@/lib/utils'
import {
  type AgencyDisplayRecord,
  agencyInitials,
} from '@/modules/profile/agency-catalog'

export function AgencyMark({
  agency,
  className,
}: {
  agency: AgencyDisplayRecord
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-muted font-mono text-sm font-semibold text-primary ring-1 ring-border',
        className,
      )}
      role="img"
      aria-label={`${agency.name} logo`}
    >
      <span aria-hidden="true">{agencyInitials(agency.name)}</span>
      {agency.logoSrc ? (
        <img
          src={agency.logoSrc}
          alt=""
          aria-hidden="true"
          className={cn(
            'absolute inset-0 size-full object-cover',
            agency.darkLogo ? 'bg-slate-900' : 'bg-white',
          )}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(event) => event.currentTarget.classList.add('hidden')}
        />
      ) : null}
    </div>
  )
}
