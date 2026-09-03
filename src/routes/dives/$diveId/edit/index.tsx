import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { z } from 'zod'
import { getDiveEditor } from '@/modules/dives/server/queries'
import { DiveEditor } from '../../-components/dive-editor'

const diveIdSchema = z.string().uuid()

export const Route = createFileRoute('/dives/$diveId/edit/')({
  loader: async ({ params }) => {
    const diveId = diveIdSchema.safeParse(params.diveId)
    if (!diveId.success) throw notFound()
    const data = await getDiveEditor({ data: { diveId: diveId.data } })
    if (!data?.dive) throw notFound()
    return { diveId: diveId.data, data }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Edit dive #${loaderData.data.dive?.number ?? '—'} · Divetracx`
          : 'Edit dive · Divetracx',
      },
    ],
  }),
  component: EditDiveRoute,
})

function EditDiveRoute() {
  const { diveId, data } = Route.useLoaderData()
  return (
    <div className="space-y-7">
      <header>
        <Link
          to="/dives/$diveId"
          params={{ diveId }}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to dive
        </Link>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Edit dive #{data.dive?.number ?? '—'}
        </h1>
      </header>
      <DiveEditor key={diveId} diveId={diveId} data={data} />
    </div>
  )
}
