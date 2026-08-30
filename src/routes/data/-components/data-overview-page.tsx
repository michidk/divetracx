import { Link } from '@tanstack/react-router'
import {
  Activity,
  Award,
  Building2,
  ChevronRight,
  ContactRound,
  Database,
  Images,
  MapPin,
  RefreshCw,
  Tags,
  UserRound,
  Waves,
  Wrench,
} from 'lucide-react'
import type { EntityKey } from '@/modules/data/entities'
import { entityDefinitionList } from '@/modules/data/entities'
import type { getDataOverview } from '@/modules/data/server/records'

type OverviewData = Awaited<ReturnType<typeof getDataOverview>>

const entityIcons = {
  dives: Waves,
  sites: MapPin,
  divers: UserRound,
  buddies: ContactRound,
  equipment: Wrench,
  certifications: Award,
  shops: Building2,
  'dive-types': Tags,
  tanks: Database,
  pictures: Images,
  'profile-samples': Activity,
  'sync-runs': RefreshCw,
} satisfies Record<EntityKey, typeof Waves>

export function DataOverviewPage({ counts }: { counts: OverviewData }) {
  const countByEntity = new Map(counts.map((item) => [item.entity, item.count]))

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Database
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Manage data</h1>
        <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
          Browse every Divetracx collection and edit normalized logbook records.
          Relationship rows for buddies and equipment are managed inside each dive.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entityDefinitionList.map((definition) => {
          const Icon = entityIcons[definition.key]
          return (
            <Link
              key={definition.key}
              to="/data/$entity"
              params={{ entity: definition.key }}
              className="group flex min-h-44 flex-col rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-slate-950/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon size={21} aria-hidden="true" />
                </span>
                <span className="font-mono text-2xl font-semibold">
                  {(countByEntity.get(definition.key) ?? 0).toLocaleString()}
                </span>
              </div>
              <h2 className="mt-5 font-semibold">{definition.plural}</h2>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-sm leading-6 text-muted-foreground">
                  {definition.description}
                </p>
                <ChevronRight
                  className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                  size={18}
                  aria-hidden="true"
                />
              </div>
            </Link>
          )
        })}
      </section>
    </div>
  )
}
