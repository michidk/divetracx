import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Bell,
  Clock3,
  Combine,
  Database,
  Gauge,
  ImageIcon,
  MapPin,
  Navigation,
  Pencil,
  Snowflake,
  Star,
  TriangleAlert,
  UserRound,
  Waves,
} from 'lucide-react'
import { PhotoManager } from '@/components/photo-manager'
import { PictureGallery } from '@/components/picture-gallery'
import { StatCard } from '@/components/stat-card'
import { Badge } from '@/components/ui/badge'
import { diveBuddyRoleLabel } from '@/modules/dives/buddy-role'
import { entryTypeLabel, waterTypeLabel } from '@/modules/dives/codes'
import { isCriticalDiveEvent } from '@/modules/dives/dive-events'
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
import { ManualDiveDiagram } from './manual-dive-diagram'

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

function gasRoleLabel(role: string) {
  switch (role) {
    case 'bottom':
      return 'Bottom gas'
    case 'deco':
      return 'Deco gas'
    case 'travel':
      return 'Travel gas'
    default:
      return role
  }
}

function describeContributions(
  contributions: DiveData['sources'][number]['contributions'],
) {
  const parts = [
    contributions.profileSamples > 0
      ? `${contributions.profileSamples.toLocaleString()} profile samples`
      : null,
    contributions.tanks > 0
      ? `${contributions.tanks} tank${contributions.tanks === 1 ? '' : 's'}`
      : null,
    contributions.events > 0
      ? `${contributions.events} computer event${contributions.events === 1 ? '' : 's'}`
      : null,
    contributions.buddies > 0 ? `${contributions.buddies} people` : null,
    contributions.equipment > 0 ? `${contributions.equipment} gear items` : null,
  ].filter(Boolean)
  return parts.length === 0 ? '' : `Added ${parts.join(', ')}`
}

function displayTankGas(tank: DiveData['tanks'][number]) {
  const oxygen = Number(tank.oxygenPercent ?? 21)
  const helium = Number(tank.heliumPercent ?? 0)
  if (helium > 0) return `${oxygen.toFixed(0)}/${helium.toFixed(0)} trimix`
  if (oxygen > 21) return `Nitrox ${oxygen.toFixed(0)}`
  return 'Air'
}

function heroMediaUrl(photo: {
  storagePath: string | null
  thumbnailStoragePath: string | null
}) {
  const path = photo.thumbnailStoragePath ?? photo.storagePath ?? ''
  return `/media/${path.split('/').map(encodeURIComponent).join('/')}`
}

function formatRecordTime(value: Date | string | null) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

export function DivePage({ dive }: { dive: DiveData }) {
  const location = [dive.site?.region, dive.site?.country].filter(Boolean).join(', ')
  const diverName = dive.diver ? formatPersonName(dive.diver) : null
  const heroPhoto = dive.photos.find((photo) => photo.storagePath)

  return (
    <div className="space-y-7">
      <header>
        <Link
          to="/dives"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to dives
        </Link>
        <div
          className={
            heroPhoto
              ? 'relative isolate mt-4 flex min-h-72 flex-col justify-end overflow-hidden rounded-2xl border border-border p-6 md:min-h-80 md:p-8'
              : 'mt-4'
          }
        >
          {heroPhoto?.storagePath ? (
            <>
              <img
                src={heroMediaUrl(heroPhoto)}
                alt={heroPhoto.description ?? 'Dive photo'}
                className="absolute inset-0 -z-20 size-full object-cover"
              />
              <span
                aria-hidden="true"
                className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-slate-950/25"
              />
            </>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 font-mono text-sm font-semibold ${heroPhoto ? 'bg-white/15 text-white backdrop-blur-sm' : 'bg-primary/10 text-primary'}`}
              >
                Dive #{dive.number ?? '—'}
              </span>
              {dive.diveTypeName ? (
                <span
                  className={`rounded-full px-3 py-1 text-sm ${heroPhoto ? 'bg-white/15 text-white/90 backdrop-blur-sm' : 'bg-muted text-muted-foreground'}`}
                >
                  {dive.diveTypeName}
                </span>
              ) : null}
              {dive.decompressionDive ? (
                <span
                  className={`rounded-full px-3 py-1 text-sm font-bold tracking-wide ring-1 ring-inset ${heroPhoto ? 'bg-red-500/30 text-red-100 ring-red-300/40 backdrop-blur-sm' : 'bg-red-500/10 text-red-600 ring-red-500/25 dark:text-red-400'}`}
                >
                  DECO
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/dives/$diveId/merge"
                params={{ diveId: dive.id }}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${heroPhoto ? 'border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20' : 'border-border hover:bg-muted'}`}
              >
                <Combine size={15} aria-hidden="true" /> Merge dives
              </Link>
              <Link
                to="/dives/$diveId/edit"
                params={{ diveId: dive.id }}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${heroPhoto ? 'border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20' : 'border-border hover:bg-muted'}`}
              >
                <Pencil size={15} aria-hidden="true" /> Edit dive
              </Link>
            </div>
          </div>
          <h1
            className={`mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl ${heroPhoto ? 'text-white drop-shadow-sm' : ''}`}
          >
            {dive.site?.name ?? 'Unknown dive site'}
          </h1>
          <p
            className={`mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 ${heroPhoto ? 'text-white/85' : 'text-muted-foreground'}`}
          >
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
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Clock3}
          label="Dive time"
          value={formatDuration(dive.durationSeconds)}
        />
        <StatCard
          icon={Gauge}
          label="Maximum depth"
          value={formatMeters(dive.maximumDepthMeters)}
        />
        <StatCard
          icon={Waves}
          label="Average depth"
          value={formatMeters(dive.averageDepthMeters)}
        />
        <StatCard
          icon={Snowflake}
          label="Water temperature"
          value={formatTemperature(dive.waterTemperatureCelsius)}
        />
      </section>

      {dive.profileSamples.length > 0 ? (
        <DiveProfileChart
          samples={dive.profileSamples}
          tanks={dive.tanks}
          events={dive.events}
        />
      ) : (
        <ManualDiveDiagram dive={dive} />
      )}

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
                label="Heart rate"
                value={
                  dive.averageHeartRateBpm === null && dive.maximumHeartRateBpm === null
                    ? null
                    : `${dive.averageHeartRateBpm ?? '—'} avg · ${dive.maximumHeartRateBpm ?? '—'} max bpm`
                }
              />
              <Value
                label="Decompression dive"
                value={dive.decompressionDive ? 'Yes' : 'No'}
              />
              <Value
                label="Deco model"
                value={
                  dive.decoModel
                    ? `${dive.decoModel}${
                        dive.gradientFactorLow !== null &&
                        dive.gradientFactorHigh !== null
                          ? ` · GF ${dive.gradientFactorLow}/${dive.gradientFactorHigh}`
                          : ''
                      }`
                    : null
                }
              />
              <Value
                label="CNS"
                value={
                  dive.endCnsPercent === null
                    ? null
                    : `${dive.startCnsPercent ?? 0}% → ${dive.endCnsPercent}%`
                }
              />
              <Value
                label="Oxygen toxicity"
                value={
                  dive.oxygenToxicityUnits === null
                    ? null
                    : `${dive.oxygenToxicityUnits} OTU`
                }
              />
              <Value
                label="Safety stop"
                value={
                  dive.safetyStop
                    ? dive.safetyStopSeconds === null
                      ? 'Yes'
                      : formatDuration(dive.safetyStopSeconds)
                    : 'No'
                }
              />
              <Value
                label="Pressure groups"
                value={
                  dive.pressureGroupBeforeInterval ||
                  dive.pressureGroupAfterInterval ||
                  dive.pressureGroupEnd
                    ? `${dive.pressureGroupBeforeInterval ?? '—'} → ${dive.pressureGroupAfterInterval ?? '—'} → ${dive.pressureGroupEnd ?? '—'}`
                    : null
                }
              />
              <Value
                label="Residual nitrogen time"
                value={formatDuration(dive.residualNitrogenSeconds)}
              />
              <Value label="Water" value={waterTypeLabel(dive.waterType)} />
              <Value label="Entry" value={entryTypeLabel(dive.entryType)} />
              <Value label="Visibility" value={dive.visibility} />
              <Value label="Current" value={dive.current} />
              <Value label="Waves" value={dive.waves} />
              <Value label="Weather" value={dive.weather} />
              <Value label="Computer" value={dive.computer} />
              <Value label="Suit" value={dive.suit} />
              <Value label="Dive operator" value={dive.shopName} />
              <Value label="Boat" value={dive.boatName} />
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
                        <p className="flex flex-wrap items-center gap-2 font-semibold">
                          {tank.name || `Tank ${index + 1}`}
                          {tank.gasRole ? (
                            <Badge
                              variant={tank.gasRole === 'deco' ? 'warning' : 'secondary'}
                            >
                              {gasRoleLabel(tank.gasRole)}
                            </Badge>
                          ) : null}
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

          {dive.events.length > 0 ? (
            <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <div className="flex items-center gap-3">
                <Bell className="text-primary" size={21} aria-hidden="true" />
                <h2 className="text-xl font-semibold">Computer events</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Gas switches and alerts the dive computer raised, in dive time.
              </p>
              <ol className="mt-4 divide-y divide-border">
                {dive.events.map((event) => {
                  const critical = isCriticalDiveEvent(event)
                  return (
                    <li
                      key={event.id}
                      className="grid grid-cols-[4.5rem_1.25rem_minmax(0,1fr)] items-center gap-3 py-2 text-sm"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatDuration(event.elapsedSeconds)}
                      </span>
                      {critical ? (
                        <TriangleAlert
                          className="text-warning"
                          size={16}
                          aria-label="Critical alert"
                        />
                      ) : event.kind === 'gas_switch' ? (
                        <span
                          className="size-3 justify-self-center rounded-full bg-primary"
                          aria-hidden="true"
                        />
                      ) : (
                        <Bell
                          className="text-muted-foreground"
                          size={16}
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={
                          critical ? 'font-semibold text-warning-foreground' : ''
                        }
                      >
                        {event.label}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </section>
          ) : null}

          <section className="rounded-2xl border border-border bg-card p-6 md:p-8">
            <div className="flex items-center gap-3">
              <ImageIcon className="text-primary" size={21} aria-hidden="true" />
              <h2 className="text-xl font-semibold">Photos</h2>
            </div>
            <PhotoManager target="dive" targetId={dive.id} pictures={dive.photos} />
          </section>

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
            <h2 className="mt-4 text-lg font-semibold">
              {dive.site ? (
                <Link
                  to="/sites/$siteId"
                  params={{ siteId: dive.site.id }}
                  className="hover:text-primary hover:underline"
                >
                  {dive.site.name}
                </Link>
              ) : (
                'Dive site'
              )}
            </h2>
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
              <Value
                label="Buddies and dive team"
                value={
                  dive.buddies.length > 0 ? (
                    <span className="flex flex-col gap-1.5">
                      {dive.buddies.map((buddy) => (
                        <span key={buddy.id} className="flex items-baseline gap-2">
                          <Link
                            to="/buddies/$buddyId"
                            params={{ buddyId: buddy.id }}
                            className="text-primary hover:underline"
                          >
                            {formatPersonName(buddy)}
                          </Link>
                          <span className="text-xs font-normal text-muted-foreground">
                            {diveBuddyRoleLabel(buddy.role)}
                          </span>
                        </span>
                      ))}
                    </span>
                  ) : (
                    '—'
                  )
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
                    <Link
                      to="/gear/$gearId"
                      params={{ gearId: item.id }}
                      className="text-sm font-medium hover:text-primary hover:underline"
                    >
                      {item.name}
                    </Link>
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
            <h2 className="mt-4 text-lg font-semibold">Recorded by</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Every computer and app this dive was read from, and what each one added.
            </p>
            {dive.sources.length === 0 ? (
              <p className="mt-4 text-sm">
                {dive.captureSource === 'computer'
                  ? 'Logged in Divetracx from computer data'
                  : 'Logged by hand in Divetracx'}
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {dive.sources.map((source) => (
                  <li
                    key={`${source.integrationKey}:${source.identityKey}`}
                    className="py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        {source.device.name ?? source.integrationName}
                      </span>
                      <Badge
                        variant={source.role === 'matched' ? 'outline' : 'secondary'}
                      >
                        {source.role === 'matched'
                          ? 'Attached to this dive'
                          : 'Created this dive'}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {[
                        source.device.name ? `via ${source.integrationName}` : null,
                        source.device.serialNumber
                          ? `serial ${source.device.serialNumber}`
                          : null,
                        source.device.softwareVersion
                          ? `firmware ${source.device.softwareVersion}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {describeContributions(source.contributions) || 'Dive details only'}
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {source.externalId ?? source.identityKey} · seen{' '}
                      {formatRecordTime(source.lastSeenAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <dl className="mt-5 space-y-5 border-t border-border pt-5">
              {dive.merges.length > 0 ? (
                <Value
                  label="Merged from"
                  value={dive.merges.map((merge) => merge.sourceLabel).join('; ')}
                />
              ) : null}
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
