import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { ChevronRight, Download, ListOrdered, RefreshCw, ScrollText } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { getNumberingStatus, renumberDives } from '@/modules/dives/server/maintenance'

export const Route = createFileRoute('/settings/')({
  loader: () => getNumberingStatus(),
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

function RenumberCard({
  status,
}: {
  status: Awaited<ReturnType<typeof getNumberingStatus>>
}) {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const clean = status.wouldChange === 0

  const issues = [
    status.duplicateNumbers > 0
      ? `${status.duplicateNumbers} ${status.duplicateNumbers === 1 ? 'number is' : 'numbers are'} used by more than one dive`
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
    <section className="rounded-2xl border border-border bg-card p-6">
      <ListOrdered className="text-primary" size={22} aria-hidden="true" />
      <h2 className="mt-5 font-semibold">Dive numbering</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {clean
          ? `All ${status.totalDives.toLocaleString()} dives are numbered 1–${status.totalDives.toLocaleString()} in chronological order.`
          : issues.length > 0
            ? `${issues.join(' and ')}. Renumbering assigns 1–${status.totalDives.toLocaleString()} strictly by date and entry time.`
            : `${status.wouldChange} dives are numbered out of chronological order. Renumbering assigns 1–${status.totalDives.toLocaleString()} strictly by date and entry time.`}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
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
    </section>
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
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Logbook maintenance
        </h2>
        <RenumberCard status={numberingStatus} />
      </div>
    </div>
  )
}
