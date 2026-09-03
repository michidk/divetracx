import { Link, useRouter } from '@tanstack/react-router'
import { Pencil, Plus, Repeat, Star } from 'lucide-react'
import { useState } from 'react'
import { CertificationCard } from '@/components/certification-card'
import { Button } from '@/components/ui/button'
import { formatDiveDate, formatPersonName } from '@/modules/dives/format'
import { setCertificationCardFeature } from '@/modules/profile/server/certifications'
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
  const [updatingFeaturedId, setUpdatingFeaturedId] = useState<string | null>(null)
  const [featureError, setFeatureError] = useState<string | null>(null)
  const router = useRouter()
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

  async function setFeatured(certification: Certification, featured: boolean) {
    setUpdatingFeaturedId(certification.id)
    setFeatureError(null)
    try {
      await setCertificationCardFeature({
        data: { certificationId: certification.id, featured },
      })
      await router.invalidate()
    } catch (error) {
      setFeatureError(
        error instanceof Error ? error.message : 'Updating the card selection failed',
      )
    } finally {
      setUpdatingFeaturedId(null)
    }
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
      <p className="mb-3 text-xs text-muted-foreground">
        Star up to eight certifications to show them on your Divetracx card.
      </p>
      {featureError ? (
        <p className="mb-3 text-sm text-red-600" aria-live="polite">
          {featureError}
        </p>
      ) : null}
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
                        <div className="-my-2 flex shrink-0 items-center">
                          <button
                            type="button"
                            aria-label={`${certification.featuredOnCard ? 'Remove' : 'Add'} ${certification.name} ${certification.featuredOnCard ? 'from' : 'to'} the Divetracx card`}
                            aria-pressed={certification.featuredOnCard}
                            disabled={updatingFeaturedId === certification.id}
                            className="grid size-11 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-primary disabled:cursor-wait disabled:opacity-50"
                            onClick={() =>
                              setFeatured(certification, !certification.featuredOnCard)
                            }
                          >
                            <Star
                              size={18}
                              className={
                                certification.featuredOnCard
                                  ? 'fill-primary text-primary'
                                  : undefined
                              }
                              aria-hidden="true"
                            />
                          </button>
                          <Link
                            to="/profile/certifications/$certificationId"
                            params={{ certificationId: certification.id }}
                            aria-label={`Edit ${certification.name}`}
                            className="grid size-11 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </Link>
                        </div>
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
