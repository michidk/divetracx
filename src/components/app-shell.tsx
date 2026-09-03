import { Link, useRouterState } from '@tanstack/react-router'
import {
  Backpack,
  ChartColumn,
  CircleUserRound,
  MapPinned,
  Settings,
  UsersRound,
  Waves,
} from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import { DEMO_MODE } from '@/lib/build-mode'

const navigation = [
  { to: '/dives', label: 'Dives', icon: Waves, exact: false },
  { to: '/sites', label: 'Sites', icon: MapPinned, exact: false },
  { to: '/buddies', label: 'Buddies', icon: UsersRound, exact: false },
  { to: '/gear', label: 'Gear', icon: Backpack, exact: false },
  { to: '/stats', label: 'Stats', icon: ChartColumn, exact: false },
  { to: '/profile', label: 'Profile', icon: CircleUserRound, exact: false },
] as const

function LogoMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
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

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  if (DEMO_MODE && pathname === '/') return children

  const preventDemoSubmit = (event: FormEvent<HTMLElement>) => {
    event.preventDefault()
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 md:px-8">
          <Link
            to={DEMO_MODE ? '/overview' : '/'}
            className="flex items-center gap-3 font-semibold tracking-tight"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <LogoMark size={20} />
            </span>
            <span className="hidden md:inline">Divetracx</span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {navigation.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                activeOptions={{ exact: item.exact }}
                activeProps={{ className: 'bg-accent text-foreground' }}
                inactiveProps={{
                  className: 'text-muted-foreground hover:text-foreground',
                }}
                className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium transition-colors sm:px-3"
              >
                <item.icon size={16} aria-hidden="true" />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            ))}
            {DEMO_MODE ? null : (
              <Link
                to="/settings"
                aria-label="Settings"
                activeOptions={{ exact: false }}
                activeProps={{ className: 'bg-accent text-foreground' }}
                inactiveProps={{
                  className: 'text-muted-foreground hover:text-foreground',
                }}
                className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium transition-colors sm:px-3"
              >
                <Settings size={16} aria-hidden="true" />
                <span className="sr-only">Settings</span>
              </Link>
            )}
          </nav>
        </div>
      </header>
      {DEMO_MODE ? (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-amber-950">
          <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 text-center text-sm font-medium">
            <LockKeyholeIcon />
            Demo mode: explore sample data; changes are disabled. First loads may be
            slower while the demo wakes up.
          </div>
        </div>
      ) : null}
      <main
        onSubmitCapture={DEMO_MODE ? preventDemoSubmit : undefined}
        className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-12"
      >
        {children}
      </main>
    </div>
  )
}

function LockKeyholeIcon() {
  return (
    <svg
      className="size-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4M12 15v3" />
    </svg>
  )
}
