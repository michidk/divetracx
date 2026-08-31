import { useRouter } from '@tanstack/react-router'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getErrorDisplayState } from '@/lib/error-display'

export function AppError({ error }: { error: Error }) {
  const router = useRouter()
  const errorState = getErrorDisplayState(error)

  return (
    <AppShell>
      <div className="flex min-h-[55vh] items-center justify-center">
        <Card className="w-full max-w-lg shadow-xl shadow-primary/5">
          <CardHeader className="items-center text-center">
            <div className="mb-3 grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertTriangle size={26} aria-hidden="true" />
            </div>
            <CardTitle className="text-xl">{errorState.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 text-center" role="alert">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{errorState.message}</p>
              {errorState.hint ? <p className="text-sm">{errorState.hint}</p> : null}
            </div>

            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => void router.navigate({ to: '/' })}>
                <Home size={16} aria-hidden="true" />
                Go to overview
              </Button>
              <Button onClick={() => void router.invalidate()}>
                <RefreshCw size={16} aria-hidden="true" />
                Try again
              </Button>
            </div>

            {import.meta.env.DEV ? <ErrorDetails error={error} /> : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}

function ErrorDetails({ error }: { error: Error }) {
  const details = error.stack || error.message

  if (!details) return null

  return (
    <details className="rounded-xl border border-border bg-muted/60 text-left">
      <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-muted-foreground">
        Error details
      </summary>
      <pre className="max-h-64 overflow-auto border-t border-border p-4 font-mono text-xs whitespace-pre-wrap break-words">
        <code>{details}</code>
      </pre>
    </details>
  )
}
