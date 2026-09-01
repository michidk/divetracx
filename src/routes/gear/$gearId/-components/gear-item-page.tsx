import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Waves, Wrench } from 'lucide-react'
import { DeleteRecordButton } from '@/components/delete-record-button'
import { DiveLinkList } from '@/components/dive-link-list'
import { EntityForm } from '@/components/entity-form'
import { Badge } from '@/components/ui/badge'
import { formatDiveDate } from '@/modules/dives/format'
import type { getGearItem } from '@/modules/gear/server/queries'

type GearDetail = NonNullable<Awaited<ReturnType<typeof getGearItem>>>

export function GearItemPage({ detail }: { detail: GearDetail }) {
  const navigate = useNavigate()
  const { item, dives } = detail
  const today = new Date().toISOString().slice(0, 10)
  const serviceDue =
    Boolean(item.serviceDueAt) &&
    !item.inactive &&
    !item.retiredAt &&
    (item.serviceDueAt as string) <= today

  return (
    <div className="space-y-7">
      <header>
        <Link
          to="/gear"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> All gear
        </Link>
        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
          {item.name}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {[item.manufacturer, item.model, item.category].filter(Boolean).join(' · ') ||
            'No details yet'}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-lg px-2.5 py-1">
            <Waves size={13} aria-hidden="true" /> {dives.length}{' '}
            {dives.length === 1 ? 'dive' : 'dives'}
          </Badge>
          {serviceDue ? (
            <Badge variant="warning" className="rounded-lg px-2.5 py-1">
              <Wrench size={13} aria-hidden="true" /> Service due{' '}
              {item.serviceDueAt ? formatDiveDate(item.serviceDueAt, 'medium') : ''}
            </Badge>
          ) : null}
          {item.retiredAt || item.inactive ? (
            <Badge variant="secondary" className="rounded-lg px-2.5 py-1">
              Retired
            </Badge>
          ) : null}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)]">
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <h2 className="border-b border-border px-5 py-4 font-semibold">
            Dives with this item
          </h2>
          <DiveLinkList dives={dives} emptyText="Not used on any dive yet." />
        </section>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Item details
          </h2>
          <EntityForm entity="equipment" recordId={item.id} record={item} />
          <div className="mt-4">
            <DeleteRecordButton
              entity="equipment"
              recordId={item.id}
              label="Delete gear item"
              confirmText={`Delete “${item.name}”? It will be removed from ${dives.length} dives. A future full import may restore it.`}
              onDeleted={() => navigate({ to: '/gear' })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
