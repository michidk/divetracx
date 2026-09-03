import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { z } from 'zod'
import { DeleteRecordButton } from '@/components/delete-record-button'
import { EntityForm } from '@/components/entity-form'
import { AgencyMark } from '@/modules/profile/components/agency-mark'
import { getAgencies } from '@/modules/profile/server/agencies'
import { getAgencyMembership } from '@/modules/profile/server/queries'

const agencyMembershipIdSchema = z.union([z.string().uuid(), z.literal('new')])

export const Route = createFileRoute('/profile/agencies/$agencyMembershipId/')({
  loader: async ({ params }) => {
    const agencyMembershipId = agencyMembershipIdSchema.safeParse(
      params.agencyMembershipId,
    )
    if (!agencyMembershipId.success) throw notFound()
    const agencyOptions = await getAgencies()
    if (agencyMembershipId.data === 'new')
      return { agencyMembershipId: 'new' as const, membership: null, agencyOptions }
    const membership = await getAgencyMembership({
      data: { agencyMembershipId: agencyMembershipId.data },
    })
    if (!membership) throw notFound()
    return { agencyMembershipId: agencyMembershipId.data, membership, agencyOptions }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.membership
          ? `${loaderData.membership.agency.name} · Divetracx`
          : 'New agency membership · Divetracx',
      },
    ],
  }),
  component: AgencyMembershipRoute,
})

function AgencyMembershipRoute() {
  const { agencyMembershipId, membership, agencyOptions } = Route.useLoaderData()
  const router = useRouter()
  const isNew = agencyMembershipId === 'new'

  return (
    <div className="mx-auto max-w-3xl space-y-7">
      <header>
        <Link
          to="/profile"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Back to profile
        </Link>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          {isNew
            ? 'New agency membership'
            : membership
              ? membership.agency.name
              : 'Agency membership'}
        </h1>
        <p className="mt-3 text-muted-foreground">
          Select an agency from your registry. Custom agencies can be added in Settings.
        </p>
      </header>

      <EntityForm
        key={agencyMembershipId}
        entity="agencyMemberships"
        recordId={agencyMembershipId}
        record={membership}
        selectOptions={{
          agencyId: agencyOptions.map((agency) => ({
            value: agency.id,
            label: agency.fullName ? `${agency.name} · ${agency.fullName}` : agency.name,
            leading: <AgencyMark agency={agency} className="size-8 rounded-lg" />,
          })),
        }}
        onSaved={() => router.navigate({ to: '/profile' })}
        renderSectionExtra={(_section, values) => {
          const agency = agencyOptions.find((option) => option.id === values.agencyId)
          if (!agency) return null
          return (
            <div className="mt-5 flex items-center gap-3 rounded-xl bg-muted/60 p-3">
              <AgencyMark agency={agency} />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Card preview
                </p>
                <p className="mt-1 font-semibold">{agency.name}</p>
              </div>
            </div>
          )
        }}
      />

      {!isNew && membership ? (
        <DeleteRecordButton
          entity="agencyMemberships"
          recordId={agencyMembershipId}
          label="Delete membership"
          confirmText={`Delete the ${membership.agency.name} membership?`}
          onDeleted={() => router.navigate({ to: '/profile' })}
        />
      ) : null}
    </div>
  )
}
