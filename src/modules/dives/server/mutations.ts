import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { deleteDiveEntry, saveDiveEntry } from './mutations.server'

const formText = z.string().max(10_000).default('')

const tankInputSchema = z.object({
  id: z.string().uuid().nullable(),
  name: formText,
  volumeLiters: formText,
  oxygenPercent: formText,
  heliumPercent: formText,
  startPressureBar: formText,
  endPressureBar: formText,
})

export const diveEntryInputSchema = z.object({
  diveId: z.union([z.string().uuid(), z.literal('new')]),
  dive: z.object({
    number: formText,
    diveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dive date is required'),
    entryTime: formText,
    durationMinutes: formText,
    surfaceIntervalMinutes: formText,
    maximumDepthMeters: formText,
    averageDepthMeters: formText,
    airTemperatureCelsius: formText,
    waterTemperatureCelsius: formText,
    weightKg: formText,
    equipmentWeightKg: formText,
    decompressionDive: z.boolean().default(false),
    visibility: formText,
    current: formText,
    waves: formText,
    weather: formText,
    rating: z.number().int().min(0).max(5).default(0),
    computer: formText,
    suit: formText,
    boat: formText,
    divemaster: formText,
    notes: formText,
    siteId: formText,
    shopId: formText,
    diveTypeId: formText,
    newShopName: formText,
    newDiveTypeName: formText,
  }),
  buddyIds: z.array(z.string().uuid()).default([]),
  equipmentIds: z.array(z.string().uuid()).default([]),
  tanks: z.array(tankInputSchema).default([]),
})

export type DiveEntryInput = z.infer<typeof diveEntryInputSchema>

export const saveDive = createServerFn({ method: 'POST' })
  .validator(diveEntryInputSchema)
  .handler(async ({ data }) => ({ id: await saveDiveEntry(data) }))

export const deleteDive = createServerFn({ method: 'POST' })
  .validator(z.object({ diveId: z.string().uuid() }))
  .handler(async ({ data }) => {
    await deleteDiveEntry(data.diveId)
  })
