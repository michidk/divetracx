import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { z } from 'zod'
import { DeleteRecordButton } from '@/components/delete-record-button'
import { EntityForm } from '@/components/entity-form'
import { agencyDisplayName } from '@/modules/profile/agency-catalog'
import { AgencyMark } from '@/modules/profile/components/agency-mark'
import { getAgencyMembership } from '@/modules/profile/server/queries'

const agencyMembershipIdSchema = z.union([z.string().uuid(), z.literal('new')])

export const Route = createFileRoute('/profile/agencies/$agencyMembershipId/')({
  loader: async ({ params }) => {
    const agencyMembershipId = agencyMembershipIdSchema.safeParse(
      params.agencyMembershipId,
    )
    if (!agencyMembershipId.success) throw notFound()
    if (agencyMembershipId.data === 'new') {
      return { agencyMembershipId: 'new' as const, membership: null }
    }
    const membership = await getAgencyMembership({
      data: { agencyMembershipId: agencyMembershipId.data },
    })
    if (!membership) throw notFound()
    return { agencyMembershipId: agencyMembershipId.data, membership }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.membership
          ? `${agencyDisplayName(loaderData.membership)} · Divetracx`
          : 'New agency membership · Divetracx',
      },
    ],
  }),
  component: AgencyMembershipRoute,
})

function AgencyMembershipRoute() {
  const { agencyMembershipId, membership } = Route.useLoaderData()
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
              ? agencyDisplayName(membership)
              : 'Agency membership'}
        </h1>
        <p className="mt-3 text-muted-foreground">
          Select a listed agency or choose Custom agency for any other organization.
        </p>
      </header>

      <EntityForm
        key={agencyMembershipId}
        entity="agencyMemberships"
        recordId={agencyMembershipId}
        record={membership}
        onSaved={() => router.navigate({ to: '/profile' })}
        renderSectionExtra={(_section, values) => {
          const agencyCode =
            typeof values.agencyCode === 'string' && values.agencyCode
              ? values.agencyCode
              : 'custom'
          const customAgencyName =
            typeof values.customAgencyName === 'string'
              ? values.customAgencyName || null
              : null
          return (
            <div className="mt-5 flex items-center gap-3 rounded-xl bg-muted/60 p-3">
              <AgencyMark agencyCode={agencyCode} customAgencyName={customAgencyName} />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Card preview
                </p>
                <p className="mt-1 font-semibold">
                  {agencyDisplayName({ agencyCode, customAgencyName })}
                </p>
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
          confirmText={`Delete the ${agencyDisplayName(membership)} membership?`}
          onDeleted={() => router.navigate({ to: '/profile' })}
        />
      ) : null}
    </div>
  )
}
