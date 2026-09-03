import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { z } from 'zod'
import { DeleteRecordButton } from '@/components/delete-record-button'
import { EntityForm } from '@/components/entity-form'
import { getBuddy, getBuddyAgencyMembership } from '@/modules/buddies/server/queries'
import { formatPersonName } from '@/modules/dives/format'
import { AgencyMark } from '@/modules/profile/components/agency-mark'
import { getAgencies } from '@/modules/profile/server/agencies'

const paramsSchema = z.object({
  buddyId: z.string().uuid(),
  buddyAgencyMembershipId: z.union([z.string().uuid(), z.literal('new')]),
})

export const Route = createFileRoute(
  '/buddies/$buddyId/agencies/$buddyAgencyMembershipId/',
)({
  loader: async ({ params }) => {
    const parsed = paramsSchema.safeParse(params)
    if (!parsed.success) throw notFound()
    const { buddyId, buddyAgencyMembershipId } = parsed.data
    const [detail, agencyOptions, membership] = await Promise.all([
      getBuddy({ data: { buddyId } }),
      getAgencies(),
      buddyAgencyMembershipId === 'new'
        ? Promise.resolve(null)
        : getBuddyAgencyMembership({
            data: { buddyId, buddyAgencyMembershipId },
          }),
    ])
    if (!detail || (buddyAgencyMembershipId !== 'new' && !membership)) {
      throw notFound()
    }
    return {
      buddyId,
      buddyAgencyMembershipId,
      buddy: detail.buddy,
      membership,
      agencyOptions,
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.membership
          ? `${loaderData.membership.agency.name} · Divetracx`
          : 'New buddy agency membership · Divetracx',
      },
    ],
  }),
  component: BuddyAgencyMembershipRoute,
})

function BuddyAgencyMembershipRoute() {
  const { buddyId, buddyAgencyMembershipId, buddy, membership, agencyOptions } =
    Route.useLoaderData()
  const router = useRouter()
  const isNew = buddyAgencyMembershipId === 'new'
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
          {isNew ? 'New buddy agency membership' : membership?.agency.name}
        </h1>
        <p className="mt-3 text-muted-foreground">
          Store {buddyName}&apos;s member or instructor number for an agency from
          Settings.
        </p>
      </header>

      <EntityForm
        key={buddyAgencyMembershipId}
        entity="buddyAgencyMemberships"
        recordId={buddyAgencyMembershipId}
        record={membership}
        fixedValues={{ buddyId }}
        selectOptions={{
          agencyId: agencyOptions.map((agency) => ({
            value: agency.id,
            label: agency.fullName ? `${agency.name} · ${agency.fullName}` : agency.name,
            leading: <AgencyMark agency={agency} className="size-8 rounded-lg" />,
          })),
        }}
        onSaved={() => router.navigate({ to: '/buddies/$buddyId', params: { buddyId } })}
      />

      {!isNew && membership ? (
        <DeleteRecordButton
          entity="buddyAgencyMemberships"
          recordId={buddyAgencyMembershipId}
          label="Delete agency membership"
          confirmText={`Delete ${buddyName}'s ${membership.agency.name} number?`}
          onDeleted={() =>
            router.navigate({ to: '/buddies/$buddyId', params: { buddyId } })
          }
        />
      ) : null}
    </div>
  )
}
