import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { getDives } from '@/modules/dives/server/queries'
import { DiveList } from './-components/dive-list'

export const Route = createFileRoute('/dives/')({
  validateSearch: z.object({
    q: z.string().max(200).catch('').optional(),
    page: z.coerce.number().int().min(1).catch(1).optional(),
  }),
  loaderDeps: ({ search }) => ({ q: search.q ?? '', page: search.page ?? 1 }),
  loader: ({ deps }) => getDives({ data: { search: deps.q, page: deps.page } }),
  head: () => ({ meta: [{ title: 'Dives · Divetracx' }] }),
  component: DivesRoute,
})

function DivesRoute() {
  const list = Route.useLoaderData()
  const { q } = Route.useSearch()
  return <DiveList list={list} search={q ?? ''} />
}
