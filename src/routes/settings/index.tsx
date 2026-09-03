import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import {
  Building2,
  ChevronRight,
  Download,
  Fish,
  ListOrdered,
  RefreshCw,
  ScrollText,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardLink,
  CardTitle,
} from '@/components/ui/card'
import { formatDiveDate } from '@/modules/dives/format'
import { getNumberingStatus, renumberDives } from '@/modules/dives/server/maintenance'

export const Route = createFileRoute('/settings/')({
  loader: () => getNumberingStatus(),
  head: () => ({ meta: [{ title: 'Settings · Divetracx' }] }),
  component: SettingsRoute,
})

const sections = [
  {
    to: '/settings/dive-types',
    label: 'Dive types',
    description: 'Rename imported classifications or add your own dive types.',
    icon: Fish,
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

function RenumberCard({
  status,
}: {
  status: Awaited<ReturnType<typeof getNumberingStatus>>
}) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const clean = status.wouldChange === 0
  const divesWithDuplicateNumbers = status.duplicateGroups.reduce(
    (total, group) => total + group.dives.length,
    0,
  )

  const issues = [
    status.duplicateNumbers > 0
      ? `${status.duplicateNumbers} dive ${status.duplicateNumbers === 1 ? 'number is' : 'numbers are'} each assigned to multiple entries (${divesWithDuplicateNumbers} affected entries)`
      : null,
    status.unnumberedDives > 0
      ? `${status.unnumberedDives} ${status.unnumberedDives === 1 ? 'dive has' : 'dives have'} no number`
      : null,
  ].filter(Boolean)

  async function run() {
    if (
      !window.confirm(
        `Renumber all ${status.totalDives} dives chronologically to 1–${status.totalDives}? ` +
          `${status.wouldChange} dives will get a new number. The new numbers are included in future exports.`,
      )
    ) {
      return
    }
    setRunning(true)
    setMessage(null)
    try {
      const result = await renumberDives()
      await router.invalidate()
      setMessage(`Renumbered ${result.changed} dives.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Renumbering failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <ListOrdered className="shrink-0 text-primary" size={22} aria-hidden="true" />
          <CardTitle>Dive numbering</CardTitle>
        </div>
        <CardDescription className="leading-6">
          {clean
            ? `All ${status.totalDives.toLocaleString()} dives are numbered 1–${status.totalDives.toLocaleString()} in chronological order.`
            : issues.length > 0
              ? `${issues.join(' and ')}. Renumbering assigns 1–${status.totalDives.toLocaleString()} strictly by date and entry time.`
              : `${status.wouldChange} dives are numbered out of chronological order. Renumbering assigns 1–${status.totalDives.toLocaleString()} strictly by date and entry time.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status.duplicateGroups.length > 0 ? (
          <div className="mb-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {status.duplicateGroups.map((group) => (
              <div
                key={group.number}
                className="rounded-xl border border-border bg-muted/25 p-3"
              >
                <p className="mb-1.5 font-mono text-xs font-semibold text-muted-foreground">
                  Dive #{group.number} is used by
                </p>
                <ul className="space-y-1">
                  {group.dives.map((dive) => (
                    <li key={dive.id}>
                      <Link
                        to="/dives/$diveId"
                        params={{ diveId: dive.id }}
                        className="block truncate text-sm font-medium text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        {dive.siteName ?? 'Unknown site'} ·{' '}
                        {formatDiveDate(dive.diveDate, 'medium')}
                        {dive.entryTime ? ` · ${dive.entryTime.slice(0, 5)}` : ''}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-4">
          <Button
            type="button"
            variant="outline"
            disabled={clean || running}
            onClick={() => void run()}
          >
            {running ? 'Renumbering…' : 'Renumber dives by date'}
          </Button>
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {message}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function SettingsRoute() {
  const numberingStatus = Route.useLoaderData()
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Logbook maintenance
        </h2>
        <RenumberCard status={numberingStatus} />
      </div>
    </div>
  )
}
