import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { z } from 'zod'
import { getMergeCandidates } from '@/modules/dives/server/merge'
import { getDive } from '@/modules/dives/server/queries'
import { MergePage } from './-components/merge-page'

const diveIdSchema = z.string().uuid()

export const Route = createFileRoute('/dives/$diveId/merge/')({
  loader: async ({ params }) => {
    const diveId = diveIdSchema.safeParse(params.diveId)
    if (!diveId.success) throw notFound()
    const [dive, candidates] = await Promise.all([
      getDive({ data: { diveId: diveId.data } }),
      getMergeCandidates({ data: { diveId: diveId.data } }),
    ])
    if (!dive || !candidates) throw notFound()
    return { diveId: diveId.data, dive, candidates: candidates.candidates }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Merge into dive #${loaderData.dive.number ?? '—'} · Divetracx`
          : 'Merge dives · Divetracx',
      },
    ],
  }),
  component: MergeDiveRoute,
})

function MergeDiveRoute() {
  const { diveId, dive, candidates } = Route.useLoaderData()
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
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Logbook
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          Merge dive #{dive.number ?? '—'}
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          A dive computer that surfaces mid-dive logs the rest as a separate entry. Pick
          the entries that belong to this dive and their profiles are appended onto one
          timeline. The earliest entry is the one that is kept.
        </p>
      </header>
      <MergePage key={diveId} diveId={diveId} candidates={candidates} />
    </div>
  )
}
