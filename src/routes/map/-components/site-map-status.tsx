import { LoaderCircle } from 'lucide-react'
import type { RefObject } from 'react'

export type SiteMapStatusValue = 'loading' | 'ready' | 'error'

export function SiteMapStatus({
  status,
  onRetry,
  retryButtonRef,
}: {
  status: SiteMapStatusValue
  onRetry: () => void
  retryButtonRef: RefObject<HTMLButtonElement | null>
}) {
  if (status === 'loading') {
    return (
      <div
        className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-muted"
        role="status"
        aria-label="Loading dive map"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-accent via-muted to-background"
        />
        <span className="relative inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground shadow-lg shadow-slate-950/5">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-primary" />
          Loading dive map…
        </span>
      </div>
    )
  }
  if (status !== 'error') return null

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-muted p-6 text-center"
      role="alert"
    >
      <div className="max-w-sm space-y-3">
        <p className="text-lg font-semibold text-foreground">Map unavailable</p>
        <p className="text-sm text-muted-foreground">
          Retry when the map service is reachable. Every dive spot remains available in
          the list.
        </p>
        <button
          ref={retryButtonRef}
          type="button"
          className="min-h-11 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:border-primary/50 hover:bg-accent"
          onClick={onRetry}
        >
          Retry map
        </button>
      </div>
    </div>
  )
}
