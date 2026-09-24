import { z } from 'zod'
import { buddyContract } from '@/modules/buddies/entity-contract'
import { mcpValuesSchema } from '@/modules/data/field-contract'
import { DIVE_BUDDY_ROLE_VALUES } from '@/modules/dives/buddy-role'
import { equipmentContract } from '@/modules/gear/entity-contract'
import { diverContract } from '@/modules/profile/entity-contract'
import { siteContract } from '@/modules/sites/entity-contract'

const nullableText = z.string().max(10_000).nullable().optional()
const nullableShortText = z.string().max(500).nullable().optional()
const nullableNumber = z.number().finite().nullable().optional()
const nullableInteger = z.number().int().nullable().optional()
const pressureGroupLetter = z
  .string()
  .regex(/^[A-Za-z]$/, 'Pressure groups are a single table letter')
  .nullable()
  .optional()

const tankSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  name: nullableShortText,
  volumeLiters: nullableNumber,
  oxygenPercent: nullableNumber,
  heliumPercent: nullableNumber,
  startPressureBar: nullableNumber,
  endPressureBar: nullableNumber,
})

const diveFields = {
  number: nullableInteger,
  diveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  entryTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .nullable()
    .optional(),
  durationSeconds: z.number().int().min(0).nullable().optional(),
  surfaceIntervalSeconds: z.number().int().min(0).nullable().optional(),
  maximumDepthMeters: z.number().min(0).nullable().optional(),
  averageDepthMeters: z.number().min(0).nullable().optional(),
  airTemperatureCelsius: nullableNumber,
  waterTemperatureCelsius: nullableNumber,
  weightKg: z.number().min(0).nullable().optional(),
  equipmentWeightKg: z.number().min(0).nullable().optional(),
  decompressionDive: z.boolean().optional(),
  safetyStop: z.boolean().optional(),
  safetyStopSeconds: z.number().int().min(0).nullable().optional(),
  pressureGroupBeforeInterval: pressureGroupLetter,
  pressureGroupAfterInterval: pressureGroupLetter,
  pressureGroupEnd: pressureGroupLetter,
  residualNitrogenSeconds: z.number().int().min(0).nullable().optional(),
  waterType: z.number().int().min(0).nullable().optional(),
  entryType: z.number().int().min(0).nullable().optional(),
  visibility: nullableShortText,
  current: nullableShortText,
  waves: nullableShortText,
  weather: nullableShortText,
  rating: z.number().int().min(1).max(5).nullable().optional(),
  computer: nullableShortText,
  suit: nullableShortText,
  notes: nullableText,
  siteId: z.string().uuid().nullable().optional(),
  shopId: z.string().uuid().nullable().optional(),
  boatId: z.string().uuid().nullable().optional(),
  diveTypeId: z.string().uuid().nullable().optional(),
} as const

const diveRelationships = {
  buddyAssignments: z
    .array(
      z.object({
        buddyId: z.string().uuid(),
        role: z.enum(DIVE_BUDDY_ROLE_VALUES).default('buddy'),
      }),
    )
    .optional(),
  equipmentIds: z.array(z.string().uuid()).optional(),
  tanks: z.array(tankSchema).optional(),
} as const

export const createDiveToolInputSchema = z.object({
  ...diveFields,
  diveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ...diveRelationships,
})

export const updateDiveToolInputSchema = z.object({
  diveId: z.string().uuid(),
  ...diveFields,
  ...diveRelationships,
})

export type CreateDiveToolInput = z.infer<typeof createDiveToolInputSchema>
export type UpdateDiveToolInput = z.infer<typeof updateDiveToolInputSchema>

// Derived straight from each domain's field contract (src/modules/*/entity-contract.ts)
// instead of being redeclared here: a field that contract exposes to MCP is
// writable through these schemas by construction, and one that changes there
// changes here too, so the two cannot drift apart the way three independent
// declarations could.
export const siteValuesSchema = mcpValuesSchema(siteContract)
export const buddyValuesSchema = mcpValuesSchema(buddyContract)
export const gearValuesSchema = mcpValuesSchema(equipmentContract)
export const profileValuesSchema = mcpValuesSchema(diverContract)

export const gearSetValuesSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  notes: z.string().max(10_000).nullable().optional(),
  inactive: z.boolean().optional(),
  equipmentIds: z.array(z.string().uuid()).optional(),
})

export type SiteValues = z.infer<typeof siteValuesSchema>
export type BuddyValues = z.infer<typeof buddyValuesSchema>
export type GearValues = z.infer<typeof gearValuesSchema>
export type ProfileValues = z.infer<typeof profileValuesSchema>
export type GearSetValues = z.infer<typeof gearSetValuesSchema>
