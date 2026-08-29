import { Link } from '@tanstack/react-router'
import { Anchor, Database, Download, RefreshCw, ScrollText } from 'lucide-react'
import type { ReactNode } from 'react'

const navigation = [
  { to: '/', label: 'Overview', icon: Anchor },
  { to: '/dives', label: 'Dives', icon: Database },
  { to: '/settings/sync', label: 'Sync', icon: RefreshCw },
  { to: '/settings/sync/logs', label: 'Sync logs', icon: ScrollText },
  { to: '/settings/export', label: 'Export', icon: Download },
] as const

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8">
          <Link to="/" className="flex items-center gap-3 font-semibold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Anchor size={18} aria-hidden="true" />
            </span>
            <span className="hidden md:inline">Divetracx</span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {navigation.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                activeOptions={{ exact: true }}
                activeProps={{ className: 'bg-accent text-foreground' }}
                inactiveProps={{
                  className: 'text-muted-foreground hover:text-foreground',
                }}
                className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors"
              >
                <item.icon size={16} aria-hidden="true" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-12">
        {children}
      </main>
    </div>
  )
}
