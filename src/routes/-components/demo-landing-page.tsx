import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Bot,
  ChartNoAxesCombined,
  Code2,
  Database,
  Download,
  FileInput,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
  UsersRound,
  Waves,
} from 'lucide-react'

const features = [
  {
    icon: FileInput,
    title: 'Import from multiple sources',
    description:
      'Bring together supported computer data, app backups, and exchange formats instead of rebuilding your history by hand.',
  },
  {
    icon: RefreshCcw,
    title: 'Reliable ongoing sync',
    description:
      'Run full historical imports or incremental updates with stable source identities, change detection, and a clear run history.',
  },
  {
    icon: Database,
    title: 'One canonical record',
    description:
      'Normalize different source schemas into one durable model while retaining provenance and keeping manual records intact.',
  },
  {
    icon: Waves,
    title: 'Complete dive detail',
    description:
      'Keep profiles, tanks, gases, pressure, temperature, decompression data, notes, ratings, and media together.',
  },
  {
    icon: UsersRound,
    title: 'The whole logbook',
    description:
      'Connect dives with sites, buddies, shops, equipment, reusable gear sets, and certifications.',
  },
  {
    icon: ChartNoAxesCombined,
    title: 'Maps and statistics',
    description:
      'Explore interactive profiles, geographic context, calendar activity, trends, personal records, and aggregate statistics.',
  },
] as const

const workflow = [
  {
    number: '01',
    title: 'Connect',
    description: 'Choose a supported source, backup, or interchange format.',
  },
  {
    number: '02',
    title: 'Normalize',
    description: 'Divetracx maps every record into the same canonical diving model.',
  },
  {
    number: '03',
    title: 'Use your data',
    description: 'Browse, analyze, export, or securely query it through MCP.',
  },
] as const

function LogoMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true">
      <g
        transform="translate(32 32) scale(1.15) translate(-32 -36.5)"
        fill="currentColor"
      >
        <path d="M28 35H36L35 46L32 56L28 59L30 47Z" />
        <path d="M32 21L27 14L21 20L7 17L12 30L23 42L29 39L32 34L35 39L41 42L52 30L57 17L43 20L37 14Z" />
      </g>
    </svg>
  )
}

export function DemoLandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="relative z-10 mx-auto flex h-20 max-w-6xl items-center justify-between px-5 md:px-8">
        <span className="flex items-center gap-3 text-lg font-semibold tracking-tight">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <LogoMark />
          </span>
          Divetracx
        </span>
        <a
          href="https://github.com/michidk/divetracx"
          aria-label="View Divetracx source on GitHub"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <Code2 size={18} aria-hidden="true" />
          <span className="hidden sm:inline">View source</span>
        </a>
      </header>

      <main>
        <section className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-12 px-5 py-16 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div className="pointer-events-none absolute -right-48 top-12 -z-0 size-[34rem] rounded-full bg-primary/10 blur-3xl" />
          <div className="relative z-10 max-w-2xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-accent/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              <LockKeyhole size={14} aria-hidden="true" /> Read-only public demo
            </p>
            <h1 className="text-5xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
              Your dives,
              <span className="block text-primary">clearly traced.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">
              A self-hosted home for dive data from different computers, apps, and
              formats—normalized into one clean, portable record you control.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to="/overview"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-opacity hover:opacity-90"
              >
                Explore the demo <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <a
                href="https://github.com/michidk/divetracx"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-6 text-sm font-semibold transition-colors hover:bg-muted"
              >
                Self-host Divetracx
              </a>
            </div>
            <p className="mt-5 text-xs leading-5 text-muted-foreground">
              No account needed. Sample names, places, and notes are fictional; all seven
              dive curves are anonymized and resampled.
            </p>
          </div>

          <div className="relative z-10 mx-auto w-full max-w-lg">
            <div className="absolute -inset-8 rounded-[3rem] bg-primary/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-6 shadow-2xl shadow-primary/10 sm:p-8">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                    Latest dive
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                    Kelp Cathedral
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sample Isles · Recreational
                  </p>
                </div>
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent text-primary">
                  <Waves size={22} aria-hidden="true" />
                </span>
              </div>
              <div className="mt-8 grid grid-cols-3 gap-3">
                {[
                  ['17.4 m', 'Max depth'],
                  ['45 min', 'Duration'],
                  ['18 °C', 'Water'],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl bg-muted/70 p-4">
                    <p className="font-mono text-base font-semibold">{value}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
              <div
                className="mt-8 h-40 overflow-hidden rounded-2xl bg-accent/60 p-4"
                aria-hidden="true"
              >
                <svg
                  className="size-full"
                  viewBox="0 0 420 130"
                  preserveAspectRatio="none"
                >
                  <title>Illustrative dive depth profile</title>
                  <path
                    d="M0 12 C38 18 40 74 79 75 S119 102 158 82 S198 114 238 92 S277 108 317 68 S356 32 420 18 L420 130 L0 130 Z"
                    fill="rgb(8 127 140 / 0.18)"
                  />
                  <path
                    d="M0 12 C38 18 40 74 79 75 S119 102 158 82 S198 114 238 92 S277 108 317 68 S356 32 420 18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    className="text-primary"
                  />
                </svg>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-card/70 py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                Dive data management
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                One logbook, without ecosystem lock-in.
              </h2>
              <p className="mt-5 text-base leading-7 text-muted-foreground">
                Divetracx is built around the diving domain, not one manufacturer or
                application. Sources can change; your canonical history stays coherent.
              </p>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="rounded-2xl border border-border bg-card p-6 shadow-sm"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-accent text-primary">
                    <feature.icon size={20} aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-border py-20 md:py-28">
          <div className="pointer-events-none absolute -left-64 top-0 size-[34rem] rounded-full bg-primary/10 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 md:px-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Bot size={23} aria-hidden="true" />
              </span>
              <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                AI-native by design
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                Your logbook can speak MCP.
              </h2>
              <p className="mt-5 text-base leading-7 text-muted-foreground">
                Connect compatible AI clients to an optional OAuth-protected Model Context
                Protocol endpoint. Ask questions across dives, profiles, sites, and
                statistics without handing an assistant direct database access.
              </p>
              <div className="mt-7 flex items-start gap-3 rounded-xl border border-border bg-card/80 p-4 text-sm leading-6 text-muted-foreground">
                <ShieldCheck className="mt-0.5 shrink-0 text-primary" size={19} />
                Bounded read-only tools keep the AI interface useful and intentionally
                constrained.
              </div>
            </div>

            <div className="rounded-[2rem] border border-border bg-card p-5 shadow-2xl shadow-primary/10 sm:p-7">
              <div className="flex items-center gap-2 border-b border-border pb-5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <span className="size-2.5 rounded-full bg-primary" /> MCP conversation
              </div>
              <div className="mt-6 ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-primary px-5 py-4 text-sm leading-6 text-primary-foreground">
                Which sites have I visited most, and how has my average depth changed this
                year?
              </div>
              <div className="mt-4 max-w-[92%] rounded-2xl rounded-bl-md bg-muted px-5 py-4 text-sm leading-6">
                I found your most-visited sites and compared the depth trend across your
                logged dives. I can also break this down by dive type or buddy.
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {['Search dives', 'Read profiles', 'Compare stats', 'Explore sites'].map(
                  (tool) => (
                    <span
                      key={tool}
                      className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground"
                    >
                      {tool}
                    </span>
                  ),
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-card/70 py-20 md:py-24">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  A simple flow
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em]">
                  From scattered files to useful history.
                </h2>
              </div>
              <ol className="grid gap-4 sm:grid-cols-3">
                {workflow.map((step) => (
                  <li
                    key={step.number}
                    className="rounded-2xl border border-border bg-card p-5"
                  >
                    <span className="font-mono text-xs font-semibold text-primary">
                      {step.number}
                    </span>
                    <h3 className="mt-4 font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {step.description}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-28">
          <div className="overflow-hidden rounded-[2rem] bg-foreground px-6 py-10 text-background sm:px-10 lg:flex lg:items-center lg:justify-between lg:gap-12 lg:px-14 lg:py-12">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 text-primary-foreground/70">
                <Download size={20} aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-[0.2em]">
                  Open and portable
                </span>
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em]">
                Keep control of the complete record.
              </h2>
              <p className="mt-4 leading-7 text-background/70">
                Self-host Divetracx, retain source provenance, and export your canonical
                data in portable formats whenever you need it.
              </p>
            </div>
            <div className="mt-8 flex shrink-0 flex-wrap gap-3 lg:mt-0">
              <Link
                to="/overview"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground"
              >
                Explore the demo <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <a
                href="https://github.com/michidk/divetracx"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-background/25 px-6 text-sm font-semibold transition-colors hover:bg-background/10"
              >
                <Code2 size={17} aria-hidden="true" /> View source
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
