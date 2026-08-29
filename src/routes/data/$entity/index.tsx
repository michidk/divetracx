import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'
import { entityDefinitions, entityKeySchema } from '@/modules/data/entities'
import { getDataList } from '@/modules/data/server/records'
import { EntityListPage } from './-components/entity-list-page'

export const Route = createFileRoute('/data/$entity/')({
  validateSearch: z.object({ page: z.coerce.number().int().min(1).catch(1).optional() }),
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: async ({ params, deps }) => {
    const entity = entityKeySchema.safeParse(params.entity)
    if (!entity.success) throw notFound()
    return {
      entity: entity.data,
      list: await getDataList({
        data: { entity: entity.data, page: deps.page },
      }),
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${entityDefinitions[loaderData.entity].plural} · Divetracx`
          : 'Data · Divetracx',
      },
    ],
  }),
  component: EntityRoute,
})

function EntityRoute() {
  const data = Route.useLoaderData()
  return <EntityListPage entity={data.entity} list={data.list} />
}
