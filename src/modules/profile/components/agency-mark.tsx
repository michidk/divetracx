import { cn } from '@/lib/utils'
import {
  type AgencyDisplayRecord,
  agencyInitials,
} from '@/modules/profile/agency-catalog'

export function AgencyMark({
  agency,
  className,
  decorative = false,
}: {
  agency: AgencyDisplayRecord
  className?: string
  decorative?: boolean
}) {
  const accessibilityProps = decorative
    ? ({ 'aria-hidden': true } as const)
    : ({ role: 'img', 'aria-label': `${agency.name} logo` } as const)

  return (
    <div
      className={cn(
        'relative grid size-16 shrink-0 place-items-center overflow-hidden bg-muted font-mono text-sm font-semibold text-primary ring-1 ring-border',
        className,
        'rounded-full',
      )}
      {...accessibilityProps}
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
            agency.code === 'cmas' && 'scale-[1.16]',
          )}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(event) => event.currentTarget.classList.add('hidden')}
        />
      ) : null}
    </div>
  )
}
