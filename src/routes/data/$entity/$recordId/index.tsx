import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'
import { entityDefinitions, entityKeySchema } from '@/modules/data/entities'
import { getDataEditor } from '@/modules/data/server/records'
import { RecordEditorPage } from './-components/record-editor-page'

const recordIdSchema = z.union([z.string().uuid(), z.literal('new')])

export const Route = createFileRoute('/data/$entity/$recordId/')({
  loader: async ({ params }) => {
    const entity = entityKeySchema.safeParse(params.entity)
    const recordId = recordIdSchema.safeParse(params.recordId)
    if (!entity.success || !recordId.success) throw notFound()

    const definition = entityDefinitions[entity.data]
    if (recordId.data === 'new' && !definition.mutable) throw notFound()

    const payload = await getDataEditor({
      data: { entity: entity.data, recordId: recordId.data },
    })
    if (recordId.data !== 'new' && !payload.record) throw notFound()
    return { entity: entity.data, recordId: recordId.data, payload }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.recordId === 'new' ? 'New' : loaderData.payload.record?.values.name || loaderData.payload.record?.values.number || entityDefinitions[loaderData.entity].singular} · Divetracx`
          : 'Record · Divetracx',
      },
    ],
  }),
  component: RecordRoute,
})

function RecordRoute() {
  const data = Route.useLoaderData()
  return (
    <RecordEditorPage
      key={`${data.entity}/${data.recordId}`}
      entity={data.entity}
      recordId={data.recordId}
      payload={data.payload}
    />
  )
}
