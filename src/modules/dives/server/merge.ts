import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { loadMergeCandidates, mergeDivesInto, previewDiveMerge } from './merge.server'

const mergeSelectionSchema = z.object({
  diveId: z.string().uuid(),
  sourceDiveIds: z.array(z.string().uuid()).max(20).default([]),
})

export const getMergeCandidates = createServerFn({ method: 'GET' })
  .validator(z.object({ diveId: z.string().uuid() }))
  .handler(({ data }) => loadMergeCandidates(data.diveId))

export const getMergePreview = createServerFn({ method: 'GET' })
  .validator(mergeSelectionSchema)
  .handler(({ data }) => previewDiveMerge(data.diveId, data.sourceDiveIds))

export const mergeDives = createServerFn({ method: 'POST' })
  .validator(
    mergeSelectionSchema.extend({
      sourceDiveIds: z.array(z.string().uuid()).min(1).max(20),
    }),
  )
  .handler(({ data }) => mergeDivesInto(data.diveId, data.sourceDiveIds))
