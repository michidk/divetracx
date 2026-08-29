import { Link } from '@tanstack/react-router'
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react'
import type { EntityKey } from '@/modules/data/entities'
import { entityDefinitions } from '@/modules/data/entities'
import type { getDataList } from '@/modules/data/server/records'

type ListData = Awaited<ReturnType<typeof getDataList>>

function formatUpdated(value: string) {
  return new Date(value).toLocaleDateString('en-US', { dateStyle: 'medium' })
}

export function EntityListPage({
  entity,
  records,
}: {
  entity: EntityKey
  records: ListData
}) {
  const definition = entityDefinitions[entity]

  return (
    <div className="space-y-7">
      <header>
        <Link
          to="/data"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> All data
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Database · {records.length.toLocaleString()} records
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              {definition.plural}
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              {definition.description}
            </p>
          </div>
          {definition.mutable ? (
            <Link
              to="/data/$entity/$recordId"
              params={{ entity, recordId: 'new' }}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20"
            >
              <Plus size={16} aria-hidden="true" /> New{' '}
              {definition.singular.toLowerCase()}
            </Link>
          ) : null}
        </div>
      </header>

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        {records.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No {definition.plural.toLowerCase()} yet.
          </p>
        ) : (
          records.map((record) => (
            <Link
              key={record.id}
              to="/data/$entity/$recordId"
              params={{ entity, recordId: record.id }}
              className="group grid min-h-20 grid-cols-[minmax(0,1fr)_auto_1.25rem] items-center gap-4 border-b border-border px-5 py-4 transition-colors last:border-0 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary md:px-6"
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">{record.title}</span>
                {record.subtitle ? (
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {record.subtitle}
                  </span>
                ) : null}
              </span>
              <span className="text-right">
                {record.detail ? (
                  <span className="block text-xs text-muted-foreground">
                    {record.detail}
                  </span>
                ) : null}
                <span className="mt-1 block text-xs text-muted-foreground">
                  {record.sourceKey === 'divemate' ? 'DiveMate' : record.sourceKey} ·{' '}
                  {formatUpdated(record.updatedAt)}
                </span>
              </span>
              <ChevronRight
                className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                size={18}
                aria-hidden="true"
              />
            </Link>
          ))
        )}
      </section>
    </div>
  )
}
