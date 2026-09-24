import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { deleteAgencyMembership, saveAgencyMembership } from './agency-memberships.server'

const recordIdSchema = z.union([z.string().uuid(), z.literal('new')])
const editorValueSchema = z.union([z.string(), z.boolean()])

export const saveAgencyMembershipRecord = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      recordId: recordIdSchema,
      values: z.record(z.string(), editorValueSchema),
    }),
  )
  .handler(async ({ data }) => ({
    id: await saveAgencyMembership(data.recordId, data.values),
  }))

export const deleteAgencyMembershipRecord = createServerFn({ method: 'POST' })
  .validator(z.object({ recordId: z.string().uuid() }))
  .handler(async ({ data }) => {
    await deleteAgencyMembership(data.recordId)
  })
