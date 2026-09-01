import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { formatDiveDate, formatDuration, formatMeters } from '@/modules/dives/format'

export interface DiveLinkItem {
  id: string
  number: number | null
  diveDate: string
  durationSeconds: number
  maximumDepthMeters: string | null
  siteName?: string | null
}

export function DiveLinkList({
  dives,
  emptyText,
}: {
  dives: DiveLinkItem[]
  emptyText: string
}) {
  if (dives.length === 0) {
    return <p className="p-8 text-center text-sm text-muted-foreground">{emptyText}</p>
  }

  return (
    <div>
      {dives.map((dive) => (
        <Link
          key={dive.id}
          to="/dives/$diveId"
          params={{ diveId: dive.id }}
          className="group grid min-h-16 grid-cols-[minmax(0,1fr)_auto_1.25rem] items-center gap-4 border-b border-border px-5 py-3 transition-colors last:border-0 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        >
          <span className="min-w-0">
            <span className="block truncate font-medium">
              {dive.siteName ?? `Dive #${dive.number ?? '—'}`}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              #{dive.number ?? '—'} · {formatDiveDate(dive.diveDate, 'medium')}
            </span>
          </span>
          <span className="text-right font-mono text-sm">
            <span className="block">{formatMeters(dive.maximumDepthMeters)}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {formatDuration(dive.durationSeconds)}
            </span>
          </span>
          <ChevronRight
            className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
            size={16}
            aria-hidden="true"
          />
        </Link>
      ))}
    </div>
  )
}
