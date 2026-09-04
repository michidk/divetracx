import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router'
import { AppError } from '@/components/app-error'
import { AppShell } from '@/components/app-shell'
import { Toaster } from '@/components/ui/toaster'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      { title: 'Divetracx' },
      {
        name: 'description',
        content: 'A self-hosted canonical dive log with DiveMate and Garmin imports.',
      },
    ],
    links: [
      { rel: 'icon', type: 'image/png', href: '/divetracx-logo-v2.png' },
      { rel: 'apple-touch-icon', href: '/divetracx-logo-v2.png' },
    ],
  }),
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
  errorComponent: AppError,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster />
        <Scripts />
      </body>
    </html>
  )
}
