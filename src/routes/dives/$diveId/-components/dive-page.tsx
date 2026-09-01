import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Clock3,
  Database,
  Gauge,
  ImageIcon,
  MapPin,
  Navigation,
  Pencil,
  Snowflake,
  Star,
  UserRound,
  Waves,
} from 'lucide-react'
import { PictureGallery } from '@/components/picture-gallery'
import {
  formatDiveDate,
  formatDuration,
  formatEntryTime,
  formatMeters,
  formatPersonName,
  formatTemperature,
} from '@/modules/dives/format'
import type { getDive } from '@/modules/dives/server/queries'
import { DiveProfileChart } from './dive-profile-chart'

type DiveData = NonNullable<Awaited<ReturnType<typeof getDive>>>

function Value({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium">{value || '—'}</dd>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <Icon className="text-primary" size={20} aria-hidden="true" />
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}

function displayTankGas(tank: DiveData['tanks'][number]) {
  const oxygen = Number(tank.oxygenPercent ?? 21)
  const helium = Number(tank.heliumPercent ?? 0)
  if (helium > 0) return `${oxygen.toFixed(0)}/${helium.toFixed(0)} trimix`
  if (oxygen > 21) return `Nitrox ${oxygen.toFixed(0)}`
  return 'Air'
}

function formatRecordTime(value: Date | string | null) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

function formatSourceCode(value: number | null) {
  return value === null ? '—' : `Code ${value}`
}

export function DivePage({ dive }: { dive: DiveData }) {
  const location = [dive.site?.region, dive.site?.country].filter(Boolean).join(', ')
  const diverName = dive.diver ? formatPersonName(dive.diver) : null

  return (
    <div className="space-y-7">
      <header>
        <Link
          to="/dives"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to dives
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-sm font-semibold text-primary">
              Dive #{dive.number ?? '—'}
            </span>
            {dive.diveTypeName ? (
              <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                {dive.diveTypeName}
              </span>
            ) : null}
            {dive.decompressionDive ? (
              <span className="rounded-full bg-red-500/10 px-3 py-1 text-sm font-bold tracking-wide text-red-600 ring-1 ring-inset ring-red-500/25 dark:text-red-400">
                DECO
              </span>
            ) : null}
          </div>
          <Link
            to="/data/$entity/$recordId"
            params={{ entity: 'dives', recordId: dive.id }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold transition hover:bg-muted"
          >
            <Pencil size={15} aria-hidden="true" /> Edit dive
          </Link>
        </div>
        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          {dive.site?.name ?? 'Unknown dive site'}
        </h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
          <span>{formatDiveDate(dive.diveDate)}</span>
          <span aria-hidden="true">·</span>
          <span>{formatEntryTime(dive.entryTime, dive.utcOffsetMinutes)}</span>
          {location ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{location}</span>
            </>
          ) : null}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={Clock3}
          label="Dive time"
          value={formatDuration(dive.durationSeconds)}
        />
        <Metric
          icon={Gauge}
          label="Maximum depth"
          value={formatMeters(dive.maximumDepthMeters)}
        />
        <Metric
          icon={Waves}
          label="Average depth"
          value={formatMeters(dive.averageDepthMeters)}
        />
        <Metric
          icon={Snowflake}
          label="Water temperature"
          value={formatTemperature(dive.waterTemperatureCelsius)}
        />
      </section>

      <DiveProfileChart samples={dive.profileSamples} tanks={dive.tanks} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
            <h2 className="text-xl font-semibold">Dive details</h2>
            <dl className="mt-6 grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              <Value
                label="Surface interval"
                value={formatDuration(dive.surfaceIntervalSeconds)}
              />
              <Value
                label="Air temperature"
                value={formatTemperature(dive.airTemperatureCelsius)}
              />
              <Value
                label="Weight"
                value={dive.weightKg ? `${Number(dive.weightKg).toFixed(1)} kg` : '—'}
              />
              <Value
                label="Equipment weight"
                value={
                  dive.equipmentWeightKg
                    ? `${Number(dive.equipmentWeightKg).toFixed(1)} kg`
                    : '—'
                }
              />
              <Value
                label="Maximum ppO₂"
                value={dive.maximumPpo2 ? Number(dive.maximumPpo2).toFixed(2) : '—'}
              />
              <Value
                label="Decompression dive"
                value={dive.decompressionDive ? 'Yes' : 'No'}
              />
              <Value label="Water type" value={formatSourceCode(dive.waterType)} />
              <Value label="Entry type" value={formatSourceCode(dive.entryType)} />
              <Value label="Visibility" value={dive.visibility} />
              <Value label="Current" value={dive.current} />
              <Value label="Waves" value={dive.waves} />
              <Value label="Weather" value={dive.weather} />
              <Value label="Computer" value={dive.computer} />
              <Value label="Suit" value={dive.suit} />
              <Value label="Boat" value={dive.boat} />
              <Value label="Dive shop" value={dive.shopName} />
              <Value
                label="Rating"
                value={
                  dive.rating ? (
                    <span className="inline-flex items-center gap-1">
                      <Star
                        className="fill-primary text-primary"
                        size={14}
                        aria-hidden="true"
                      />
                      {dive.rating}
                    </span>
                  ) : null
                }
              />
            </dl>
          </section>

          {dive.tanks.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <h2 className="text-xl font-semibold">Tanks</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {dive.tanks.map((tank, index) => (
                  <article key={tank.id} className="rounded-xl bg-muted/60 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">
                          {tank.name || `Tank ${index + 1}`}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {displayTankGas(tank)}
                        </p>
                      </div>
                      <p className="font-mono text-sm">
                        {tank.volumeLiters
                          ? `${Number(tank.volumeLiters).toFixed(0)} L`
                          : '—'}
                      </p>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                      <Value
                        label="Start"
                        value={
                          tank.startPressureBar
                            ? `${Number(tank.startPressureBar).toFixed(0)} bar`
                            : '—'
                        }
                      />
                      <Value
                        label="End"
                        value={
                          tank.endPressureBar
                            ? `${Number(tank.endPressureBar).toFixed(0)} bar`
                            : '—'
                        }
                      />
                      <Value
                        label="Computer channel"
                        value={
                          tank.computerTankNumber === null
                            ? '—'
                            : `Tank ${tank.computerTankNumber}`
                        }
                      />
                      <Value
                        label="Breathing time"
                        value={
                          tank.breathingTimeSeconds === null
                            ? '—'
                            : formatDuration(tank.breathingTimeSeconds)
                        }
                      />
                      <Value
                        label="Working pressure"
                        value={
                          tank.workingPressureBar
                            ? `${Number(tank.workingPressureBar).toFixed(0)} bar`
                            : '—'
                        }
                      />
                      <Value
                        label="Tank weight"
                        value={
                          tank.weightKg ? `${Number(tank.weightKg).toFixed(1)} kg` : '—'
                        }
                      />
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {dive.photos.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <div className="flex items-center gap-3">
                <ImageIcon className="text-primary" size={21} aria-hidden="true" />
                <h2 className="text-xl font-semibold">Photos</h2>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Attachments linked to this canonical dive record.
              </p>
              <PictureGallery pictures={dive.photos} />
            </section>
          ) : null}

          {dive.signatures.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <div className="flex items-center gap-3">
                <ImageIcon className="text-primary" size={21} aria-hidden="true" />
                <h2 className="text-xl font-semibold">Signatures</h2>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Dive verification signatures imported from DiveMate.
              </p>
              <PictureGallery pictures={dive.signatures} />
            </section>
          ) : null}

          {dive.notes ? (
            <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <h2 className="text-xl font-semibold">Notes</h2>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                {dive.notes}
              </p>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-6">
            <MapPin className="text-primary" size={21} aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">Dive site</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {dive.site?.waterName || location || 'Location not recorded'}
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-5">
              <Value label="Region" value={dive.site?.region} />
              <Value label="Country" value={dive.site?.country} />
              <Value label="Difficulty" value={dive.site?.difficulty} />
              <Value
                label="Site depth"
                value={formatMeters(dive.site?.maximumDepthMeters ?? null)}
              />
              <Value
                label="Altitude"
                value={
                  dive.site?.altitudeMeters === null ||
                  dive.site?.altitudeMeters === undefined
                    ? '—'
                    : `${dive.site.altitudeMeters} m`
                }
              />
              <Value label="Site rating" value={dive.site?.rating} />
            </dl>
            {dive.site?.latitude && dive.site.longitude ? (
              <a
                href={`https://www.openstreetmap.org/?mlat=${encodeURIComponent(dive.site.latitude)}&mlon=${encodeURIComponent(dive.site.longitude)}#map=12/${encodeURIComponent(dive.site.latitude)}/${encodeURIComponent(dive.site.longitude)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
              >
                <Navigation size={15} aria-hidden="true" />
                {Number(dive.site.latitude).toFixed(5)},{' '}
                {Number(dive.site.longitude).toFixed(5)}
              </a>
            ) : null}
            {dive.site?.notes ? (
              <p className="mt-4 border-t border-border pt-4 text-sm leading-6 text-muted-foreground">
                {dive.site.notes}
              </p>
            ) : null}
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <UserRound className="text-primary" size={21} aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">People</h2>
            <dl className="mt-5 space-y-5">
              <Value label="Diver" value={diverName} />
              <Value label="Divemaster" value={dive.divemaster} />
              <Value label="Legacy buddy note" value={dive.legacyBuddyText} />
              <Value
                label="Buddies"
                value={
                  dive.buddies.length > 0
                    ? dive.buddies.map(formatPersonName).join(', ')
                    : '—'
                }
              />
            </dl>
          </section>

          {dive.equipment.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold">Equipment</h2>
              <ul className="mt-4 divide-y divide-border">
                {dive.equipment.map((item) => (
                  <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {[item.manufacturer, item.model, item.category]
                        .filter(Boolean)
                        .join(' · ') || 'No details'}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-2xl border border-border bg-card p-6">
            <Database className="text-primary" size={21} aria-hidden="true" />
            <h2 className="mt-4 text-lg font-semibold">Record</h2>
            <dl className="mt-5 space-y-5">
              {dive.sources.length === 0 ? (
                <Value label="Provenance" value="Created in Divetracx" />
              ) : (
                dive.sources.map((source) => (
                  <Value
                    key={`${source.integrationKey}:${source.identityKey}`}
                    label={source.integrationKey === 'divemate' ? 'DiveMate' : 'Garmin'}
                    value={`${source.externalId ?? source.identityKey} · seen ${formatRecordTime(source.lastSeenAt)}`}
                  />
                ))
              )}
              <Value label="Last changed" value={formatRecordTime(dive.updatedAt)} />
            </dl>
          </section>
        </aside>
      </div>
    </div>
  )
}

export function DiveNotFound() {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center">
      <h1 className="text-2xl font-semibold">Dive not found</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        This dive does not exist or is no longer available.
      </p>
      <Link
        to="/dives"
        className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back to dives
      </Link>
    </div>
  )
}
