import { createFileRoute } from '@tanstack/react-router'
import {
  Bot,
  Building2,
  ChevronRight,
  Download,
  Fish,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Ship,
} from 'lucide-react'
import { CardDescription, CardHeader, CardLink, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/settings/')({
  head: () => ({ meta: [{ title: 'Settings · Divetracx' }] }),
  component: SettingsRoute,
})

const sections = [
  {
    to: '/settings/data-verification',
    label: 'Data verification',
    description: 'Check dive numbering and review entries that may be duplicates.',
    icon: ShieldCheck,
  },
  {
    to: '/settings/mcp',
    label: 'AI access',
    description: 'Configure MCP tools, permissions, clients, and activity.',
    icon: Bot,
  },
  {
    to: '/settings/dive-types',
    label: 'Dive types',
    description: 'Rename imported classifications or add your own dive types.',
    icon: Fish,
  },
  {
    to: '/settings/operators-boats',
    label: 'Dive operators & boats',
    description: 'List and rename the operators and boats used by your dives.',
    icon: Ship,
  },
  {
    to: '/settings/agencies',
    label: 'Agencies',
    description: 'View built-in training agencies and add your own organizations.',
    icon: Building2,
  },
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <CardLink key={section.to} to={section.to} className="p-6">
            <CardHeader className="flex-row items-center gap-2.5 p-0">
              <section.icon
                className="shrink-0 text-primary"
                size={22}
                aria-hidden="true"
              />
              <CardTitle className="flex flex-1 items-center justify-between gap-2">
                {section.label}
                <ChevronRight
                  size={16}
                  aria-hidden="true"
                  className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </CardTitle>
            </CardHeader>
            <CardDescription className="mt-3 leading-6">
              {section.description}
            </CardDescription>
          </CardLink>
        ))}
      </div>
    </div>
  )
}
