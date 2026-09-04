import { z } from 'zod'
import { DIVE_BUDDY_ROLE_VALUES } from '@/modules/dives/buddy-role'

const nullableText = z.string().max(10_000).nullable().optional()
const nullableShortText = z.string().max(500).nullable().optional()
const nullableNumber = z.number().finite().nullable().optional()
const nullableInteger = z.number().int().nullable().optional()
const nullableDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
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

export const siteValuesSchema = z.object({
  name: nullableShortText,
  country: nullableShortText,
  region: nullableShortText,
  waterName: nullableShortText,
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  maximumDepthMeters: z.number().min(0).nullable().optional(),
  altitudeMeters: nullableInteger,
  difficulty: nullableShortText,
  rating: z.number().int().min(1).max(5).nullable().optional(),
  waterType: z.number().int().min(0).nullable().optional(),
  notes: nullableText,
})

export const buddyValuesSchema = z.object({
  firstName: nullableShortText,
  lastName: nullableShortText,
  email: nullableShortText,
  phone: nullableShortText,
  street: nullableShortText,
  postalCode: nullableShortText,
  city: nullableShortText,
  state: nullableShortText,
  country: nullableShortText,
  instructor: z.boolean().optional(),
  minimumDives: z.number().int().min(0).nullable().optional(),
  notes: nullableText,
})

export const gearValuesSchema = z.object({
  name: nullableShortText,
  category: nullableShortText,
  manufacturer: nullableShortText,
  model: nullableShortText,
  serialNumber: nullableShortText,
  information: nullableText,
  purchasedAt: nullableDate,
  purchasePrice: z.number().min(0).nullable().optional(),
  purchaseShop: nullableShortText,
  retiredAt: nullableDate,
  serviceDueAt: nullableDate,
  inactive: z.boolean().optional(),
  weightKg: z.number().min(0).nullable().optional(),
  notes: nullableText,
})

export const profileValuesSchema = z.object({
  firstName: nullableShortText,
  lastName: nullableShortText,
  email: nullableShortText,
  phone: nullableShortText,
  street: nullableShortText,
  postalCode: nullableShortText,
  city: nullableShortText,
  state: nullableShortText,
  country: nullableShortText,
  birthDate: nullableDate,
  bloodGroup: nullableShortText,
  emergencyContact: nullableShortText,
  emergencyPhone: nullableShortText,
  emergencyEmail: nullableShortText,
  insurance: nullableShortText,
  insuranceTariff: nullableShortText,
  insuranceNumber: nullableShortText,
  insuranceHotline: nullableShortText,
  notes: nullableText,
})

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
