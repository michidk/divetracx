import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { GearSetForm } from '@/modules/gear/components/gear-set-form'
import { getGearSetEditor } from '@/modules/gear/server/queries'

export const Route = createFileRoute('/gear/sets/new/')({
  loader: async () => {
    const data = await getGearSetEditor({ data: { gearSetId: null } })
    if (!data) throw notFound()
    return data
  },
  head: () => ({ meta: [{ title: 'New gear set · Divetracx' }] }),
  component: NewGearSetRoute,
})

function NewGearSetRoute() {
  const router = useRouter()
  const data = Route.useLoaderData()
  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header>
        <Link
          to="/gear"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to gear
        </Link>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">New gear set</h1>
        <p className="mt-3 text-muted-foreground">
          Save a reusable group of items for quickly filling in a dive.
        </p>
      </header>
      <GearSetForm
        data={data}
        onSaved={(id) =>
          router.navigate({ to: '/gear/sets/$gearSetId', params: { gearSetId: id } })
        }
      />
    </div>
  )
}
