import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronRight, Download, RefreshCw, ScrollText } from 'lucide-react'

export const Route = createFileRoute('/settings/')({
  head: () => ({ meta: [{ title: 'Settings · Divetracx' }] }),
  component: SettingsRoute,
})

const sections = [
  {
    to: '/settings/sync',
    label: 'Integrations',
    description: 'Import from DiveMate backups and Garmin, run a sync manually.',
    icon: RefreshCw,
  },
  {
    to: '/settings/sync/logs',
    label: 'Import history',
    description: 'Every import run with counts, diagnostics, and errors.',
    icon: ScrollText,
  },
  {
    to: '/settings/export',
    label: 'Export',
    description: 'Download your logbook as CSV, JSON, UDDF, or a DiveMate database.',
    icon: Download,
  },
] as const

function SettingsRoute() {
  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Settings
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          Data in &amp; data out
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Divetracx keeps the canonical copy of your logbook. Manage where dives come from
          and take your data with you anytime.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.to}
            to={section.to}
            className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <section.icon className="text-primary" size={22} aria-hidden="true" />
            <h2 className="mt-5 flex items-center justify-between gap-2 font-semibold">
              {section.label}
              <ChevronRight
                size={16}
                aria-hidden="true"
                className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
              />
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {section.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
