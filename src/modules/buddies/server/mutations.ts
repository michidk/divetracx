import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  deleteBuddyAgencyMembership,
  deleteBuddyCertification,
  saveBuddyAgencyMembership,
  saveBuddyCertification,
} from './credentials.server'
import { deleteBuddy, saveBuddy } from './mutations.server'

const recordIdSchema = z.union([z.string().uuid(), z.literal('new')])
const editorValueSchema = z.union([z.string(), z.boolean()])
const valuesSchema = z.record(z.string(), editorValueSchema)

export const saveBuddyRecord = createServerFn({ method: 'POST' })
  .validator(z.object({ recordId: recordIdSchema, values: valuesSchema }))
  .handler(async ({ data }) => ({ id: await saveBuddy(data.recordId, data.values) }))

export const deleteBuddyRecord = createServerFn({ method: 'POST' })
  .validator(z.object({ recordId: z.string().uuid() }))
  .handler(async ({ data }) => {
    await deleteBuddy(data.recordId)
  })

export const saveBuddyCertificationRecord = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      buddyId: z.string().uuid(),
      recordId: recordIdSchema,
      values: valuesSchema,
    }),
  )
  .handler(async ({ data }) => ({
    id: await saveBuddyCertification(data.buddyId, data.recordId, data.values),
  }))

export const deleteBuddyCertificationRecord = createServerFn({ method: 'POST' })
  .validator(z.object({ recordId: z.string().uuid() }))
  .handler(async ({ data }) => {
    await deleteBuddyCertification(data.recordId)
  })

export const saveBuddyAgencyMembershipRecord = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      buddyId: z.string().uuid(),
      recordId: recordIdSchema,
      values: valuesSchema,
    }),
  )
  .handler(async ({ data }) => ({
    id: await saveBuddyAgencyMembership(data.buddyId, data.recordId, data.values),
  }))

export const deleteBuddyAgencyMembershipRecord = createServerFn({ method: 'POST' })
  .validator(z.object({ recordId: z.string().uuid() }))
  .handler(async ({ data }) => {
    await deleteBuddyAgencyMembership(data.recordId)
  })
