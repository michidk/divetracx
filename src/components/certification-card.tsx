import { Repeat } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface CertificationCardProps {
  name: string
  organization: string | null
  certificationNumber: string | null
  frontSrc: string | null
  backSrc: string | null
  className?: string
  flipped?: boolean
  onFlippedChange?: (flipped: boolean) => void
}

function PlaceholderFace({
  name,
  organization,
  certificationNumber,
}: Pick<CertificationCardProps, 'name' | 'organization' | 'certificationNumber'>) {
  return (
    <div className="flex h-full w-full flex-col justify-between bg-gradient-to-br from-primary via-primary to-cyan-800 p-4 text-left text-primary-foreground">
      <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-90">
        {organization ?? 'Certification'}
      </p>
      <div>
        <p className="font-semibold leading-snug">{name}</p>
        {certificationNumber ? (
          <p className="mt-1 font-mono text-xs tracking-wider opacity-80">
            {certificationNumber}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export function CertificationCard({
  name,
  organization,
  certificationNumber,
  frontSrc,
  backSrc,
  className,
  flipped: controlledFlipped,
  onFlippedChange,
}: CertificationCardProps) {
  const [internalFlipped, setInternalFlipped] = useState(false)
  const flipped = controlledFlipped ?? internalFlipped
  const canFlip = Boolean(backSrc)

  function flip() {
    if (!canFlip) return
    const nextFlipped = !flipped
    if (controlledFlipped === undefined) setInternalFlipped(nextFlipped)
    onFlippedChange?.(nextFlipped)
  }

  const front = frontSrc ? (
    <img
      src={frontSrc}
      alt={`${name} card, front`}
      className="h-full w-full object-cover"
      loading="lazy"
    />
  ) : (
    <PlaceholderFace
      name={name}
      organization={organization}
      certificationNumber={certificationNumber}
    />
  )

  return (
    <div className={cn('[perspective:1600px]', className)}>
      <button
        type="button"
        onClick={flip}
        disabled={!canFlip}
        aria-label={
          canFlip
            ? `${name} card, showing ${flipped ? 'back' : 'front'}. Flip card`
            : `${name} card`
        }
        className={cn(
          'relative block aspect-[856/540] w-full transition-transform duration-500 [transform-style:preserve-3d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary',
          flipped && '[transform:rotateY(180deg)]',
          canFlip && 'cursor-pointer',
        )}
      >
        <span className="absolute inset-0 overflow-hidden rounded-xl shadow-md ring-1 ring-black/10 [backface-visibility:hidden]">
          {front}
          {canFlip ? (
            <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold text-white">
              <Repeat size={11} aria-hidden="true" /> Flip
            </span>
          ) : null}
        </span>
        {backSrc ? (
          <span className="absolute inset-0 overflow-hidden rounded-xl shadow-md ring-1 ring-black/10 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <img
              src={backSrc}
              alt={`${name} card, back`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold text-white">
              <Repeat size={11} aria-hidden="true" /> Flip
            </span>
          </span>
        ) : null}
      </button>
    </div>
  )
}
