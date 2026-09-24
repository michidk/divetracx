import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { z } from 'zod'
import { CertificationCard } from '@/components/certification-card'
import { DeleteRecordButton } from '@/components/delete-record-button'
import { EntityForm } from '@/components/entity-form'
import { presentationList } from '@/modules/data/field-contract'
import { formatPersonName } from '@/modules/dives/format'
import { AgencyMark } from '@/modules/profile/components/agency-mark'
import { certificationContract } from '@/modules/profile/credential-contracts'
import { getAgencies } from '@/modules/profile/server/agencies'
import {
  deleteCertificationRecord,
  saveCertificationRecord,
} from '@/modules/profile/server/certifications'
import {
  getCertification,
  getCertificationInstructorOptions,
} from '@/modules/profile/server/queries'

const certificationPresentation = presentationList(certificationContract)

function mediaUrl(path: string) {
  return `/media/${path.split('/').map(encodeURIComponent).join('/')}`
}

function scanMediaUrl(
  scan: { thumbnailStoragePath: string | null; storagePath: string | null } | undefined,
) {
  const path = scan?.thumbnailStoragePath ?? scan?.storagePath
  return path ? mediaUrl(path) : null
}

const certificationIdSchema = z.union([z.string().uuid(), z.literal('new')])

export const Route = createFileRoute('/profile/certifications/$certificationId/')({
  loader: async ({ params }) => {
    const certificationId = certificationIdSchema.safeParse(params.certificationId)
    if (!certificationId.success) throw notFound()
    const [instructorOptions, agencyOptions] = await Promise.all([
      getCertificationInstructorOptions(),
      getAgencies(),
    ])
    if (certificationId.data === 'new') {
      return {
        certificationId: 'new' as const,
        detail: null,
        instructorOptions,
        agencyOptions,
      }
    }
    const detail = await getCertification({
      data: { certificationId: certificationId.data },
    })
    if (!detail) throw notFound()
    return {
      certificationId: certificationId.data,
      detail,
      instructorOptions,
      agencyOptions,
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.detail
          ? `${loaderData.detail.certification.name} · Divetracx`
          : 'New certification · Divetracx',
      },
    ],
  }),
  component: CertificationRoute,
})

function CertificationRoute() {
  const { certificationId, detail, instructorOptions, agencyOptions } =
    Route.useLoaderData()
  const router = useRouter()
  const isNew = certificationId === 'new'

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
          {isNew ? 'New certification' : detail?.certification.name}
        </h1>
      </header>

      {detail && detail.scans.length > 0 ? (
        <section>
          <CertificationCard
            name={detail.certification.name}
            organization={detail.certification.organization}
            certificationNumber={detail.certification.certificationNumber}
            frontSrc={scanMediaUrl(detail.scans[0])}
            backSrc={scanMediaUrl(detail.scans[1])}
            className="mx-auto w-full max-w-md"
          />
        </section>
      ) : null}

      <EntityForm
        key={certificationId}
        presentation={certificationPresentation}
        recordId={certificationId}
        record={detail?.certification ?? null}
        onSubmit={(recordId, values) =>
          saveCertificationRecord({ data: { recordId, values } })
        }
        selectOptions={{
          agencyId: agencyOptions.map((agency) => ({
            value: agency.id,
            label: agency.fullName ? `${agency.name} · ${agency.fullName}` : agency.name,
            leading: <AgencyMark agency={agency} className="size-8" />,
          })),
          instructorBuddyId: instructorOptions.map((buddy) => ({
            value: buddy.id,
            label: formatPersonName(buddy),
          })),
        }}
        onSaved={() => router.navigate({ to: '/profile' })}
      />

      {!isNew && detail ? (
        <DeleteRecordButton
          onDelete={() =>
            deleteCertificationRecord({ data: { recordId: certificationId } })
          }
          label="Delete certification"
          confirmText={`Delete “${detail.certification.name}” and its card scans? A future full import may restore it.`}
          onDeleted={() => router.navigate({ to: '/profile' })}
        />
      ) : null}
    </div>
  )
}
