import { createFileRoute, notFound } from '@tanstack/react-router'
import { entityDefinitions, entityKeySchema } from '@/modules/data/entities'
import { getDataList } from '@/modules/data/server/records'
import { EntityListPage } from './-components/entity-list-page'

export const Route = createFileRoute('/data/$entity/')({
  loader: async ({ params }) => {
    const entity = entityKeySchema.safeParse(params.entity)
    if (!entity.success) throw notFound()
    return {
      entity: entity.data,
      records: await getDataList({ data: { entity: entity.data } }),
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
  return <EntityListPage entity={data.entity} records={data.records} />
}
