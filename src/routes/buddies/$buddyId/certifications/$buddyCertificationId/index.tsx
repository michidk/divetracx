import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { z } from 'zod'
import { DeleteRecordButton } from '@/components/delete-record-button'
import { EntityForm } from '@/components/entity-form'
import { getBuddy, getBuddyCertification } from '@/modules/buddies/server/queries'
import { formatPersonName } from '@/modules/dives/format'
import { AgencyMark } from '@/modules/profile/components/agency-mark'
import { getAgencies } from '@/modules/profile/server/agencies'

const paramsSchema = z.object({
  buddyId: z.string().uuid(),
  buddyCertificationId: z.union([z.string().uuid(), z.literal('new')]),
})

export const Route = createFileRoute(
  '/buddies/$buddyId/certifications/$buddyCertificationId/',
)({
  loader: async ({ params }) => {
    const parsed = paramsSchema.safeParse(params)
    if (!parsed.success) throw notFound()
    const { buddyId, buddyCertificationId } = parsed.data
    const [detail, agencyOptions, certification] = await Promise.all([
      getBuddy({ data: { buddyId } }),
      getAgencies(),
      buddyCertificationId === 'new'
        ? Promise.resolve(null)
        : getBuddyCertification({ data: { buddyId, buddyCertificationId } }),
    ])
    if (!detail || (buddyCertificationId !== 'new' && !certification)) {
      throw notFound()
    }
    return {
      buddyId,
      buddyCertificationId,
      buddy: detail.buddy,
      certification,
      agencyOptions,
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.certification
          ? `${loaderData.certification.name} · Divetracx`
          : 'New buddy certification · Divetracx',
      },
    ],
  }),
  component: BuddyCertificationRoute,
})

function BuddyCertificationRoute() {
  const { buddyId, buddyCertificationId, buddy, certification, agencyOptions } =
    Route.useLoaderData()
  const router = useRouter()
  const isNew = buddyCertificationId === 'new'
  const buddyName = formatPersonName(buddy)

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header>
        <Link
          to="/buddies/$buddyId"
          params={{ buddyId }}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to {buddyName}
        </Link>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          {isNew ? 'New buddy certification' : certification?.name}
        </h1>
        <p className="mt-3 text-muted-foreground">
          Record the issuing agency and certification held by {buddyName}.
        </p>
      </header>

      <EntityForm
        key={buddyCertificationId}
        entity="buddyCertifications"
        recordId={buddyCertificationId}
        record={certification}
        fixedValues={{ buddyId }}
        selectOptions={{
          agencyId: agencyOptions.map((agency) => ({
            value: agency.id,
            label: agency.fullName ? `${agency.name} · ${agency.fullName}` : agency.name,
            leading: <AgencyMark agency={agency} className="size-8" />,
          })),
        }}
        onSaved={() => router.navigate({ to: '/buddies/$buddyId', params: { buddyId } })}
      />

      {!isNew && certification ? (
        <DeleteRecordButton
          entity="buddyCertifications"
          recordId={buddyCertificationId}
          label="Delete certification"
          confirmText={`Delete “${certification.name}” from ${buddyName}?`}
          onDeleted={() =>
            router.navigate({ to: '/buddies/$buddyId', params: { buddyId } })
          }
        />
      ) : null}
    </div>
  )
}
