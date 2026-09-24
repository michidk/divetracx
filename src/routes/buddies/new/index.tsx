import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { EntityForm } from '@/components/entity-form'
import { buddyContract } from '@/modules/buddies/entity-contract'
import { saveBuddyRecord } from '@/modules/buddies/server/mutations'
import { presentationList } from '@/modules/data/field-contract'

const buddyPresentation = presentationList(buddyContract)

export const Route = createFileRoute('/buddies/new/')({
  head: () => ({ meta: [{ title: 'New buddy · Divetracx' }] }),
  component: NewBuddyRoute,
})

function NewBuddyRoute() {
  const router = useRouter()
  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header>
        <Link
          to="/buddies"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to buddies
        </Link>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">New buddy</h1>
      </header>
      <EntityForm
        presentation={buddyPresentation}
        recordId="new"
        record={null}
        onSubmit={(recordId, values) => saveBuddyRecord({ data: { recordId, values } })}
        onSaved={(id) =>
          router.navigate({ to: '/buddies/$buddyId', params: { buddyId: id } })
        }
      />
    </div>
  )
}
