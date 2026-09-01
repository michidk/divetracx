import { Link } from '@tanstack/react-router'
import { ChevronRight, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDiveDate } from '@/modules/dives/format'
import type { getGear } from '@/modules/gear/server/queries'

type GearData = Awaited<ReturnType<typeof getGear>>

function isServiceDue(item: GearData[number]) {
  if (!item.serviceDueAt || item.inactive || item.retiredAt) return false
  return item.serviceDueAt <= new Date().toISOString().slice(0, 10)
}

function GearRow({ item }: { item: GearData[number] }) {
  return (
    <Link
      to="/gear/$gearId"
      params={{ gearId: item.id }}
      className={`group grid min-h-16 grid-cols-[minmax(0,1fr)_auto_1.25rem] items-center gap-4 border-b border-border px-5 py-3 transition-colors last:border-0 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${item.inactive || item.retiredAt ? 'opacity-60' : ''}`}
    >
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{item.name}</span>
          {isServiceDue(item) ? <Badge variant="warning">Service due</Badge> : null}
          {item.retiredAt || item.inactive ? (
            <Badge variant="secondary">Retired</Badge>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {[item.manufacturer, item.model].filter(Boolean).join(' ') || 'No details'}
        </span>
      </span>
      <span className="text-right text-sm">
        <span className="block font-mono">
          {item.diveCount} {item.diveCount === 1 ? 'dive' : 'dives'}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {item.lastUsedDate
            ? `Last used ${formatDiveDate(item.lastUsedDate, 'medium')}`
            : 'Never used'}
        </span>
      </span>
      <ChevronRight
        className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
        size={16}
        aria-hidden="true"
      />
    </Link>
  )
}

export function GearPage({ gear }: { gear: GearData }) {
  const categories = Array.from(
    new Set(gear.map((item) => item.category ?? 'Uncategorized')),
  )
  const serviceDueCount = gear.filter(isServiceDue).length

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Equipment
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Gear</h1>
          <p className="mt-3 text-muted-foreground">
            {gear.length} items in your locker
            {serviceDueCount > 0
              ? ` — ${serviceDueCount} ${serviceDueCount === 1 ? 'needs' : 'need'} a service`
              : ''}
            .
          </p>
        </div>
        <Link
          to="/gear/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20"
        >
          <Plus size={16} aria-hidden="true" /> Add gear
        </Link>
      </header>

      {gear.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No gear yet. Add items here, then attach them to dives in the dive editor.
        </p>
      ) : (
        <div className="space-y-6">
          {categories.map((category) => (
            <section
              key={category}
              className="overflow-hidden rounded-2xl border border-border bg-card"
            >
              <h2 className="border-b border-border bg-muted/50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {category}
              </h2>
              {gear
                .filter((item) => (item.category ?? 'Uncategorized') === category)
                .map((item) => (
                  <GearRow key={item.id} item={item} />
                ))}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
