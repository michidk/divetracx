import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { getDiveEditor } from '@/modules/dives/server/queries'
import { DiveEditor } from '../-components/dive-editor'

export const Route = createFileRoute('/dives/new/')({
  loader: async () => {
    const data = await getDiveEditor({ data: { diveId: null } })
    if (!data) throw new Error('Could not prepare the dive editor')
    return data
  },
  head: () => ({ meta: [{ title: 'Log dive · Divetracx' }] }),
  component: NewDiveRoute,
})

function NewDiveRoute() {
  const data = Route.useLoaderData()
  return (
    <div className="space-y-7">
      <header>
        <Link
          to="/dives"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to dives
        </Link>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Log a dive</h1>
        <p className="mt-3 text-muted-foreground">
          Everything about the dive lives here — conditions, tanks, buddies, and gear.
        </p>
      </header>
      <DiveEditor diveId="new" data={data} />
    </div>
  )
}
