import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { EntityForm } from '@/components/entity-form'

export const Route = createFileRoute('/sites/new/')({
  head: () => ({ meta: [{ title: 'New dive site · Divetracx' }] }),
  component: NewSiteRoute,
})

function NewSiteRoute() {
  const router = useRouter()
  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header>
        <Link
          to="/sites"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to sites
        </Link>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">New dive site</h1>
      </header>
      <EntityForm
        entity="sites"
        recordId="new"
        record={null}
        onSaved={(id) =>
          router.navigate({ to: '/sites/$siteId', params: { siteId: id } })
        }
      />
    </div>
  )
}
