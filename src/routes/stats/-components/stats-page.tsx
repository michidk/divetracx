import { Link } from '@tanstack/react-router'
import {
  Anchor,
  Award,
  Clock3,
  Gauge,
  Hourglass,
  Percent,
  Thermometer,
  Timer,
  UsersRound,
  Waves,
  Weight,
  Wind,
} from 'lucide-react'
import { StatCard } from '@/components/stat-card'
import {
  formatDiveDate,
  formatDuration,
  formatMeters,
  formatPersonName,
  formatTemperature,
} from '@/modules/dives/format'
import type { getStatistics } from '@/modules/dives/server/stats'
import { CertificationTimeline } from './certification-timeline'
import { DepthTrend } from './depth-trend'
import { DiveHeatmap } from './dive-heatmap'

type StatisticsData = Awaited<ReturnType<typeof getStatistics>>

function mediaUrl(path: string) {
  return `/media/${path.split('/').map(encodeURIComponent).join('/')}`
}

function mixtureName(mixture: NonNullable<StatisticsData['preferredMixture']>) {
  if (mixture.heliumPercent > 0)
    return `TMX ${mixture.oxygenPercent}/${mixture.heliumPercent}`
  if (mixture.oxygenPercent === 21) return 'Air'
  return `EAN${mixture.oxygenPercent}`
}

function SectionHeading({ children }: { children: string }) {
  return (
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  )
}

export function StatsPage({ data }: { data: StatisticsData }) {
  const { summary, sac, decoSeconds, preferredMixture, bestBuddy, certifications } = data

  const decoShare =
    summary.totalDives > 0
      ? `${((summary.decompressionDives / summary.totalDives) * 100).toFixed(1)} %`
      : '—'
  const organizations = [
    ...new Set(certifications.map((c) => c.organization).filter(Boolean)),
  ]

  return (
    <div className="space-y-10">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Logbook
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Statistics</h1>
        <p className="mt-3 text-muted-foreground">
          {summary.totalDives > 0 && summary.firstDiveDate
            ? `${summary.totalDives.toLocaleString()} dives since ${formatDiveDate(summary.firstDiveDate)}.`
            : 'Log dives to see your statistics grow.'}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {bestBuddy ? (
          <Link
            to="/buddies/$buddyId"
            params={{ buddyId: bestBuddy.id }}
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {bestBuddy.picturePath ? (
              <img
                src={mediaUrl(bestBuddy.picturePath)}
                alt=""
                aria-hidden="true"
                className="size-14 shrink-0 rounded-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="grid size-14 shrink-0 place-items-center rounded-full bg-accent text-primary">
                <UsersRound size={22} aria-hidden="true" />
              </span>
            )}
            <span>
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best dive buddy
              </span>
              <span className="mt-1 block text-xl font-semibold tracking-tight group-hover:text-primary">
                {formatPersonName(bestBuddy)}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {bestBuddy.diveCount.toLocaleString()}{' '}
                {bestBuddy.diveCount === 1 ? 'dive' : 'dives'} together
              </span>
            </span>
          </Link>
        ) : (
          <article className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-accent text-primary">
              <UsersRound size={22} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Best dive buddy
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                No buddies linked to dives yet.
              </span>
            </span>
          </article>
        )}
        <Link
          to="/profile"
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-accent text-primary">
            <Award size={22} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Certificates
            </span>
            <span className="mt-1 block text-xl font-semibold tracking-tight group-hover:text-primary">
              {certifications.length.toLocaleString()}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {organizations.length > 0
                ? organizations.join(' · ')
                : 'No certifications recorded yet.'}
            </span>
          </span>
        </Link>
      </section>

      <section>
        <SectionHeading>Time underwater</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Waves}
            label="Number of dives"
            value={summary.totalDives.toLocaleString()}
            detail={
              summary.firstDiveDate
                ? `First dive ${formatDiveDate(summary.firstDiveDate, 'medium')}`
                : undefined
            }
          />
          <StatCard
            icon={Clock3}
            label="Total dive time"
            value={formatDuration(summary.totalSeconds)}
          />
          <StatCard
            icon={Hourglass}
            label="Longest dive"
            value={formatDuration(summary.longestSeconds)}
          />
          <StatCard
            icon={Timer}
            label="Average dive time"
            value={formatDuration(summary.averageSeconds)}
          />
        </div>
      </section>

      <section>
        <SectionHeading>Depth</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={Anchor}
            label="Maximum reached depth"
            value={formatMeters(summary.maximumDepthMeters)}
          />
          <StatCard
            icon={Gauge}
            label="Average max depth"
            value={formatMeters(summary.averageMaximumDepthMeters)}
            detail="Mean of each dive's deepest point"
          />
          <StatCard
            icon={Gauge}
            label="Average depth"
            value={formatMeters(summary.averageDepthMeters)}
            detail="Mean of each dive's average depth"
          />
        </div>
      </section>

      <section>
        <SectionHeading>Depth over time</SectionHeading>
        <DepthTrend points={data.depthByMonth} />
      </section>

      <section>
        <SectionHeading>Gas &amp; conditions</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Wind}
            label="Preferred mixture"
            value={preferredMixture ? mixtureName(preferredMixture) : '—'}
            detail={
              preferredMixture
                ? `${preferredMixture.oxygenPercent}% O₂ · used in ${preferredMixture.tankCount.toLocaleString()} ${preferredMixture.tankCount === 1 ? 'tank' : 'tanks'}`
                : 'No tanks recorded yet'
            }
          />
          <StatCard
            icon={Gauge}
            label="Average SAC consumption"
            value={sac.average ? `${Number(sac.average).toFixed(2)} L/min` : '—'}
            detail={
              sac.average
                ? `${sac.deviation ? `± ${Number(sac.deviation).toFixed(2)} · ` : ''}from ${sac.diveCount.toLocaleString()} ${sac.diveCount === 1 ? 'dive' : 'dives'} with tank data`
                : 'Needs tank volumes and pressures'
            }
          />
          <StatCard
            icon={Weight}
            label="Average weight"
            value={
              summary.averageWeightKg
                ? `${Number(summary.averageWeightKg).toFixed(1)} kg`
                : '—'
            }
          />
          <StatCard
            icon={Thermometer}
            label="Minimum temperature"
            value={formatTemperature(summary.minimumWaterTemperatureCelsius)}
            detail="Coldest recorded water"
          />
        </div>
      </section>

      <section>
        <SectionHeading>Decompression</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard
            icon={Hourglass}
            label="Total time in deco"
            value={formatDuration(decoSeconds)}
            detail="Time under a deco ceiling across all profiles"
          />
          <StatCard
            icon={Percent}
            label="Dives in deco"
            value={decoShare}
            detail={`${summary.decompressionDives.toLocaleString()} ${summary.decompressionDives === 1 ? 'dive' : 'dives'} with mandatory stops`}
          />
        </div>
      </section>

      {data.divesPerYear.length > 0 ? (
        <section>
          <SectionHeading>Dives per year</SectionHeading>
          <DiveHeatmap
            years={[...data.divesPerYear].reverse()}
            calendarDives={data.calendarDives}
          />
        </section>
      ) : null}

      <section>
        <SectionHeading>Certification timeline</SectionHeading>
        <CertificationTimeline certifications={certifications} />
      </section>
    </div>
  )
}
