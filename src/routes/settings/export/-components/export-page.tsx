import { Download, FileCode2, FileJson2, ShieldAlert, Table2 } from 'lucide-react'
import type { ComponentType } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ExportOption {
  title: string
  description: string
  details: string
  href: string
  label: string
  icon: ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
}

const exportOptions: ExportOption[] = [
  {
    title: 'DiveMate backup',
    description: 'A one-off DiveMate-compatible SQLite backup built from canonical data.',
    details:
      'DDB · includes supported dives, profiles, sites, people, equipment, tanks, and pictures',
    href: '/api/export/divemate',
    label: 'Download DDB',
    icon: Download,
  },
  {
    title: 'Divetracx backup',
    description: 'A complete, versioned copy of your Divetracx database records.',
    details:
      'JSON · dives, sites, people, equipment, tanks, pictures, certifications, and sync history',
    href: '/api/export/json',
    label: 'Download JSON',
    icon: FileJson2,
  },
  {
    title: 'Dive spreadsheet',
    description: 'One joined row per dive for spreadsheets and data analysis.',
    details: 'CSV · UTF-8 with sites, buddies, equipment, tanks, and measurements',
    href: '/api/export/csv',
    label: 'Download CSV',
    icon: Table2,
  },
  {
    title: 'Universal dive log',
    description: 'A portable logbook for software that supports the UDDF standard.',
    details: 'UDDF 3.2.3 · SI units, diver details, sites, and high-level dive data',
    href: '/api/export/uddf',
    label: 'Download UDDF',
    icon: FileCode2,
  },
]

export function ExportPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Settings
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Export data</h1>
        <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
          Keep an independent backup, open your dives in a spreadsheet, or move your
          logbook to another compatible application.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {exportOptions.map((option) => (
          <Card
            key={option.href}
            className="flex flex-col rounded-2xl border border-border bg-card p-6"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <option.icon size={21} aria-hidden={true} />
            </span>
            <h2 className="mt-5 text-lg font-semibold">{option.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {option.description}
            </p>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              {option.details}
            </p>
            <a
              href={option.href}
              download
              className={cn(buttonVariants(), 'mt-6 lg:mt-auto lg:translate-y-2')}
            >
              <Download size={16} aria-hidden="true" />
              {option.label}
            </a>
          </Card>
        ))}
      </section>

      <Alert variant="warning">
        <ShieldAlert
          className="mt-0.5 shrink-0 text-amber-600"
          size={22}
          aria-hidden="true"
        />
        <div>
          <AlertTitle>Treat exports as personal data</AlertTitle>
          <AlertDescription>
            Downloads can contain contact details, locations, health information, and
            private notes. Store them securely and delete copies you no longer need.
          </AlertDescription>
        </div>
      </Alert>

      <p className="text-sm leading-6 text-muted-foreground">
        The DiveMate exporter uses the configured backup only as a proprietary schema
        template; rows are rebuilt from canonical Divetracx data. Unsupported source-only
        fields are omitted. JSON is the lossless Divetracx backup.
      </p>
    </div>
  )
}
