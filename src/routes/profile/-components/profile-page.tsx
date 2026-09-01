import { Link } from '@tanstack/react-router'
import { Award, Clock3, Pencil, Plus, Waves } from 'lucide-react'
import { EntityForm } from '@/components/entity-form'
import { formatDiveDate, formatPersonName } from '@/modules/dives/format'
import type { getProfile } from '@/modules/profile/server/queries'

type ProfileData = Awaited<ReturnType<typeof getProfile>>

function mediaUrl(path: string) {
  return `/media/${path.split('/').map(encodeURIComponent).join('/')}`
}

function formatHours(seconds: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(
    seconds / 3600,
  )
}

export function ProfilePage({ profile }: { profile: ProfileData }) {
  const { diver, certifications, logbook } = profile

  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Diver</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          {diver ? formatPersonName(diver) : 'Profile'}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {logbook.firstDiveDate
            ? `Diving since ${formatDiveDate(logbook.firstDiveDate)}`
            : 'Your personal details, emergency information, and certifications.'}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-5">
          <Waves className="text-primary" size={20} aria-hidden="true" />
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Logged dives
          </p>
          <p className="mt-1 text-xl font-semibold">
            {logbook.totalDives.toLocaleString()}
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-5">
          <Clock3 className="text-primary" size={20} aria-hidden="true" />
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Bottom time
          </p>
          <p className="mt-1 text-xl font-semibold">
            {formatHours(logbook.totalSeconds)} h
          </p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-5">
          <Award className="text-primary" size={20} aria-hidden="true" />
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Certifications
          </p>
          <p className="mt-1 text-xl font-semibold">{certifications.length}</p>
        </article>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)]">
        <section>
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Certifications
            </h2>
            <Link
              to="/profile/certifications/$certificationId"
              params={{ certificationId: 'new' }}
              className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <Plus size={15} aria-hidden="true" /> Add certification
            </Link>
          </div>
          {certifications.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No certifications yet.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {certifications.map((certification) => (
                <article
                  key={certification.id}
                  className="flex flex-col rounded-2xl border border-border bg-card p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold leading-snug">{certification.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[certification.organization, certification.certificationNumber]
                          .filter(Boolean)
                          .join(' · ') || 'No details'}
                      </p>
                    </div>
                    <Link
                      to="/profile/certifications/$certificationId"
                      params={{ certificationId: certification.id }}
                      aria-label={`Edit ${certification.name}`}
                      className="shrink-0 rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <Pencil size={15} aria-hidden="true" />
                    </Link>
                  </div>
                  {certification.scans.length > 0 ? (
                    <div className="mt-4 flex gap-3">
                      {certification.scans.map((scan) => (
                        <img
                          key={scan.id}
                          src={mediaUrl(
                            scan.thumbnailStoragePath ?? scan.storagePath ?? '',
                          )}
                          alt={scan.description ?? 'Certification scan'}
                          className="h-20 w-32 rounded-lg object-cover"
                          loading="lazy"
                        />
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-auto pt-4 text-xs text-muted-foreground">
                    {certification.certifiedAt
                      ? `Certified ${formatDiveDate(certification.certifiedAt)}`
                      : 'Certification date not set'}
                    {certification.instructorName
                      ? ` · ${certification.instructorName}`
                      : ''}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Personal details
          </h2>
          {diver ? (
            <EntityForm entity="divers" recordId={diver.id} record={diver} />
          ) : (
            <EntityForm entity="divers" recordId="new" record={null} />
          )}
        </div>
      </div>
    </div>
  )
}
