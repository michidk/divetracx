import { Link } from '@tanstack/react-router'
import {
  Backpack,
  CircleUserRound,
  MapPinned,
  Settings,
  UsersRound,
  Waves,
} from 'lucide-react'
import type { ReactNode } from 'react'

const navigation = [
  { to: '/dives', label: 'Dives', icon: Waves, exact: false },
  { to: '/sites', label: 'Sites', icon: MapPinned, exact: false },
  { to: '/buddies', label: 'Buddies', icon: UsersRound, exact: false },
  { to: '/gear', label: 'Gear', icon: Backpack, exact: false },
  { to: '/profile', label: 'Profile', icon: CircleUserRound, exact: false },
] as const

function LogoMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M8 16 22 46h15l10-17"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="22" r="7" fill="currentColor" />
    </svg>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 md:px-8">
          <Link to="/" className="flex items-center gap-3 font-semibold tracking-tight">
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
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-12">
        {children}
      </main>
    </div>
  )
}
