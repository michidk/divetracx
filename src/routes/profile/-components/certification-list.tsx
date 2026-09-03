import { Link } from '@tanstack/react-router'
import { Pencil, Plus, Repeat } from 'lucide-react'
import { useState } from 'react'
import { CertificationCard } from '@/components/certification-card'
import { Button } from '@/components/ui/button'
import { formatDiveDate, formatPersonName } from '@/modules/dives/format'
import type { getProfile } from '@/modules/profile/server/queries'

type Certification = Awaited<ReturnType<typeof getProfile>>['certifications'][number]

function mediaUrl(path: string) {
  return `/media/${path.split('/').map(encodeURIComponent).join('/')}`
}

function scanSrc(scan: Certification['scans'][number] | undefined) {
  const path = scan?.thumbnailStoragePath ?? scan?.storagePath
  return path ? mediaUrl(path) : null
}

function groupByYear(certifications: Certification[]) {
  const sorted = [...certifications].sort((a, b) => {
    if (!a.certifiedAt) return b.certifiedAt ? 1 : 0
    if (!b.certifiedAt) return -1
    return b.certifiedAt.localeCompare(a.certifiedAt)
  })
  const groups: Array<{ year: string; items: Certification[] }> = []
  for (const certification of sorted) {
    const year = certification.certifiedAt
      ? certification.certifiedAt.slice(0, 4)
      : 'Undated'
    const group = groups.at(-1)
    if (group?.year === year) {
      group.items.push(certification)
    } else {
      groups.push({ year, items: [certification] })
    }
  }
  return groups
}

export function CertificationList({
  certifications,
}: {
  certifications: Certification[]
}) {
  const [flippedById, setFlippedById] = useState<Record<string, boolean>>({})
  const flippable = certifications.filter((certification) => certification.scans[1])
  const allFlipped =
    flippable.length > 0 &&
    flippable.every((certification) => flippedById[certification.id])

  function turnAllCards() {
    const nextFlipped = !allFlipped
    setFlippedById(
      Object.fromEntries(
        flippable.map((certification) => [certification.id, nextFlipped]),
      ),
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Certifications
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={flippable.length === 0}
            onClick={turnAllCards}
          >
            <Repeat size={15} aria-hidden="true" />
            {allFlipped ? 'Show all fronts' : 'Show all backs'}
          </Button>
          <Link
            to="/profile/certifications/$certificationId"
            params={{ certificationId: 'new' }}
            className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <Plus size={15} aria-hidden="true" /> Add certification
          </Link>
        </div>
      </div>
      {certifications.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No certifications yet.
        </p>
      ) : (
        <div className="space-y-6">
          {groupByYear(certifications).map((group) => (
            <section key={group.year}>
              <h3 className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground after:h-px after:flex-1 after:bg-border">
                {group.year}
              </h3>
              <ul className="grid gap-x-4 gap-y-6 sm:grid-cols-2">
                {group.items.map((certification) => {
                  const meta =
                    (certification.certifiedAt
                      ? formatDiveDate(certification.certifiedAt)
                      : null) ||
                    [certification.organization, certification.certificationNumber]
                      .filter(Boolean)
                      .join(' · ')
                  return (
                    <li key={certification.id} className="min-w-0">
                      <CertificationCard
                        name={certification.name}
                        organization={certification.organization}
                        certificationNumber={certification.certificationNumber}
                        frontSrc={scanSrc(certification.scans[0])}
                        backSrc={scanSrc(certification.scans[1])}
                        flipped={Boolean(flippedById[certification.id])}
                        onFlippedChange={(flipped) =>
                          setFlippedById((current) => ({
                            ...current,
                            [certification.id]: flipped,
                          }))
                        }
                      />
                      <div className="mt-2.5 flex items-start justify-between gap-2 px-0.5">
                        <div className="min-w-0">
                          <Link
                            to="/profile/certifications/$certificationId"
                            params={{ certificationId: certification.id }}
                            className="block truncate text-sm font-semibold hover:text-primary"
                          >
                            {certification.name}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {meta || (!certification.instructor ? 'No details' : null)}
                            {meta && certification.instructor ? ' · ' : null}
                            {certification.instructor ? (
                              <Link
                                to="/buddies/$buddyId"
                                params={{ buddyId: certification.instructor.id }}
                                className="hover:text-primary hover:underline"
                              >
                                {formatPersonName(certification.instructor)}
                              </Link>
                            ) : null}
                          </p>
                        </div>
                        <Link
                          to="/profile/certifications/$certificationId"
                          params={{ certificationId: certification.id }}
                          aria-label={`Edit ${certification.name}`}
                          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </Link>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
