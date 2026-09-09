import { Drawer } from '@base-ui/react/drawer'
import { Link } from '@tanstack/react-router'
import { ChevronRight, Ellipsis, X } from 'lucide-react'
import { useState } from 'react'
import {
  isNavigationItemActive,
  mobileMoreNavigation,
  mobileTabNavigation,
  type NavigationItem,
} from '@/lib/navigation'
import { cn } from '@/lib/utils'

const tabClassName =
  'flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-semibold leading-none transition-colors'

export function MobileNav({ pathname }: { pathname: string }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = mobileMoreNavigation.some((item) =>
    isNavigationItemActive(item, pathname),
  )

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto flex h-16 max-w-lg items-stretch gap-1 px-2">
        {mobileTabNavigation.map((item) => (
          <MobileTab key={item.to} item={item} />
        ))}
        <Drawer.Root open={moreOpen} onOpenChange={setMoreOpen}>
          <Drawer.Trigger
            className={cn(
              tabClassName,
              moreActive || moreOpen
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Ellipsis size={22} strokeWidth={moreActive ? 2.5 : 2} aria-hidden="true" />
            More
          </Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Backdrop className="divetracx-sheet-backdrop fixed inset-0 z-40 min-h-dvh bg-foreground" />
            <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
              <Drawer.Popup
                aria-label="More destinations"
                className="divetracx-sheet w-full max-w-lg rounded-t-3xl border border-b-0 border-border bg-card pb-[env(safe-area-inset-bottom)] text-card-foreground shadow-xl shadow-slate-950/10 outline-none"
              >
                <div
                  className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-border"
                  aria-hidden="true"
                />
                <Drawer.Content className="px-4 pt-4 pb-4">
                  <div className="flex items-center justify-between gap-3 px-2">
                    <Drawer.Title className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                      More
                    </Drawer.Title>
                    <Drawer.Close
                      aria-label="Close"
                      className="grid size-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X size={18} aria-hidden="true" />
                    </Drawer.Close>
                  </div>
                  <ul className="mt-2 flex flex-col">
                    {mobileMoreNavigation.map((item) => (
                      <li key={item.to}>
                        <SheetLink
                          item={item}
                          active={isNavigationItemActive(item, pathname)}
                          onNavigate={() => setMoreOpen(false)}
                        />
                      </li>
                    ))}
                  </ul>
                </Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    </nav>
  )
}

function MobileTab({ item }: { item: NavigationItem }) {
  return (
    <Link
      to={item.to}
      activeOptions={{ exact: false }}
      activeProps={{ className: 'text-primary' }}
      inactiveProps={{ className: 'text-muted-foreground hover:text-foreground' }}
      className={tabClassName}
    >
      {({ isActive }) => (
        <>
          <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} aria-hidden="true" />
          {item.label}
        </>
      )}
    </Link>
  )
}

function SheetLink({
  item,
  active,
  onNavigate,
}: {
  item: NavigationItem
  active: boolean
  onNavigate: () => void
}) {
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-16 items-center gap-4 rounded-2xl px-3 transition-colors',
        active ? 'bg-accent text-foreground' : 'hover:bg-muted/50',
      )}
    >
      <span
        className={cn(
          'grid size-11 shrink-0 place-items-center rounded-xl',
          active ? 'bg-primary text-primary-foreground' : 'bg-accent text-primary',
        )}
      >
        <item.icon size={20} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{item.label}</span>
        <span className="block text-xs text-muted-foreground">{item.description}</span>
      </span>
      <ChevronRight
        size={18}
        className="shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </Link>
  )
}
