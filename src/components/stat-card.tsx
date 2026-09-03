import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: ReactNode
  detail?: ReactNode
}

export function StatCard({ icon: Icon, label, value, detail }: StatCardProps) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Icon className="shrink-0 text-primary" size={20} aria-hidden="true" />
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {detail ? <p className="mt-2 text-xs text-muted-foreground">{detail}</p> : null}
    </article>
  )
}
