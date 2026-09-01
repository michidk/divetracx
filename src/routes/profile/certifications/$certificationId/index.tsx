import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { z } from 'zod'
import { EntityForm } from '@/components/entity-form'
import { PictureGallery } from '@/components/picture-gallery'
import { getCertification } from '@/modules/profile/server/queries'

const certificationIdSchema = z.union([z.string().uuid(), z.literal('new')])

export const Route = createFileRoute('/profile/certifications/$certificationId/')({
  loader: async ({ params }) => {
    const certificationId = certificationIdSchema.safeParse(params.certificationId)
    if (!certificationId.success) throw notFound()
    if (certificationId.data === 'new') {
      return { certificationId: 'new' as const, detail: null }
    }
    const detail = await getCertification({
      data: { certificationId: certificationId.data },
    })
    if (!detail) throw notFound()
    return { certificationId: certificationId.data, detail }
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
  const { certificationId, detail } = Route.useLoaderData()
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
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-semibold">Card scans</h2>
          <PictureGallery pictures={detail.scans} />
        </section>
      ) : null}

      <EntityForm
        key={certificationId}
        entity="certifications"
        recordId={certificationId}
        record={detail?.certification ?? null}
        onSaved={() => router.navigate({ to: '/profile' })}
      />
    </div>
  )
}
