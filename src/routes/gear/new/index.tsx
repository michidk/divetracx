import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { EntityForm } from '@/components/entity-form'

export const Route = createFileRoute('/gear/new/')({
  head: () => ({ meta: [{ title: 'New gear · Divetracx' }] }),
  component: NewGearRoute,
})

function NewGearRoute() {
  const router = useRouter()
  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header>
        <Link
          to="/gear"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to gear
        </Link>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">New gear item</h1>
      </header>
      <EntityForm
        entity="equipment"
        recordId="new"
        record={null}
        onSaved={(id) => router.navigate({ to: '/gear/$gearId', params: { gearId: id } })}
      />
    </div>
  )
}
