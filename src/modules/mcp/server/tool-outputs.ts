import { z } from 'zod'

// Shapes advertised as MCP `outputSchema`, describing the JSON a tool answers
// with rather than the objects it holds in memory: `Date` cannot be represented
// in JSON Schema, and every value crosses the wire serialised. `readResult`
// validates against that serialised form so the two cannot disagree.
//
// Most columns behind these reads are nullable even where the demo dataset
// happens to be populated, so a field is only required here when the database
// forbids null or the value is computed.
//
// Objects built from a query row are loose: a strict object silently strips
// keys it does not declare, so adding a column to a projection would quietly
// remove it from the answer with nothing failing. Loose objects keep the extra
// key and advertise that more may appear. Wrappers the tool itself assembles
// stay strict, since their keys are fixed here.

const id = z.uuid()
const optionalText = z.string().nullable()

// Drizzle maps `numeric` columns to strings to preserve their scale, so depths,
// pressures, and coordinates arrive as decimal strings rather than numbers.
const decimalString = (unit: string) =>
  z.string().nullable().describe(`Decimal string in ${unit}`)

const isoDate = z.string().nullable().describe('Calendar date as YYYY-MM-DD')
const isoTimestamp = z.string().nullable().describe('ISO 8601 timestamp')

// Photos and signatures are the same picture rows, split by kind.
const pictureElement = z.looseObject({
  id: z.string(),
  kind: optionalText,
  path: optionalText,
  storagePath: optionalText,
  thumbnailStoragePath: optionalText,
  mimeType: optionalText,
  description: optionalText,
  sortOrder: z.number().int().nullable(),
})

const diveSummary = z.looseObject({
  id,
  number: z.number().int(),
  diveDate: isoDate,
  durationSeconds: z.number().int().nullable(),
  maximumDepthMeters: decimalString('metres'),
  siteName: optionalText,
  diveTypeName: optionalText,
})

export const searchDivesOutput = z.object({
  records: z.array(
    diveSummary.extend({
      entryTime: optionalText.describe('Local entry time as HH:MM:SS'),
      averageDepthMeters: decimalString('metres'),
      waterTemperatureCelsius: decimalString('degrees Celsius'),
      country: optionalText,
      decompressionDive: z.boolean(),
      picturePath: optionalText.describe('Relative media path, when a photo exists'),
    }),
  ),
  total: z.number().int(),
  page: z.number().int(),
  pageCount: z.number().int(),
  pageSize: z.number().int(),
})

export const listDiveSitesOutput = z.object({
  sites: z.array(
    z.looseObject({
      id,
      name: z.string(),
      country: optionalText,
      region: optionalText,
      waterName: optionalText,
      latitude: decimalString('decimal degrees'),
      longitude: decimalString('decimal degrees'),
      difficulty: optionalText,
      rating: z.number().int().nullable(),
      diveCount: z.number().int(),
      lastDiveDate: isoDate,
      deepestMeters: decimalString('metres'),
    }),
  ),
  total: z.number().int(),
  offset: z.number().int(),
  limit: z.number().int(),
  hasMore: z.boolean(),
})

export const listBuddiesOutput = z.array(
  z.looseObject({
    id,
    firstName: optionalText,
    lastName: optionalText,
    email: optionalText,
    city: optionalText,
    country: optionalText,
    instructor: z.boolean(),
    diveCount: z.number().int(),
    lastDiveDate: isoDate,
    profileImage: optionalText.describe('Relative media path, when a photo exists'),
  }),
)

export const listGearOutput = z.object({
  items: z.array(
    z.looseObject({
      id,
      name: z.string(),
      category: optionalText,
      manufacturer: optionalText,
      model: optionalText,
      serviceDueAt: isoDate,
      retiredAt: isoDate,
      inactive: z.boolean(),
      diveCount: z.number().int(),
      lastUsedDate: isoDate,
    }),
  ),
  sets: z.array(
    z.looseObject({
      id,
      name: z.string(),
      notes: optionalText,
      inactive: z.boolean(),
      memberCount: z.number().int(),
    }),
  ),
})

// `calendarDives` is stripped by the tool, so it is deliberately absent here.
export const divingStatisticsOutput = z.object({
  summary: z.looseObject({
    totalDives: z.number().int(),
    totalSeconds: z.number().int(),
    longestSeconds: z.number().int(),
    averageSeconds: z.number().int(),
    maximumDepthMeters: decimalString('metres'),
    averageMaximumDepthMeters: decimalString('metres'),
    averageDepthMeters: decimalString('metres'),
    decompressionDives: z.number().int(),
    averageWeightKg: decimalString('kilograms'),
    minimumWaterTemperatureCelsius: decimalString('degrees Celsius'),
    firstDiveDate: isoDate,
  }),
  sac: z.looseObject({
    average: decimalString('litres per minute'),
    deviation: decimalString('litres per minute'),
    diveCount: z.number().int(),
  }),
  decoSeconds: z.number().int(),
  preferredMixture: z
    .looseObject({
      oxygenPercent: z.number(),
      heliumPercent: z.number(),
      tankCount: z.number().int(),
    })
    .nullable(),
  bestBuddy: z
    .looseObject({
      id,
      firstName: optionalText,
      lastName: optionalText,
      diveCount: z.number().int(),
      picturePath: optionalText,
    })
    .nullable(),
  certifications: z.array(
    z.looseObject({
      id,
      name: optionalText,
      organization: optionalText,
      certifiedAt: isoDate,
    }),
  ),
  divesPerYear: z.array(
    z.looseObject({ year: z.number().int(), diveCount: z.number().int() }),
  ),
  depthByMonth: z.array(
    z.looseObject({
      month: z.string().describe('Calendar month as YYYY-MM'),
      averageDepthMeters: decimalString('metres'),
      averageMaximumDepthMeters: decimalString('metres'),
      diveCount: z.number().int(),
    }),
  ),
})

const diveUsage = z.looseObject({
  id,
  number: z.number().int(),
  diveDate: isoDate,
  durationSeconds: z.number().int().nullable(),
  maximumDepthMeters: decimalString('metres'),
  siteName: optionalText,
  diveTypeName: optionalText,
})

export const getDiveOutput = z.looseObject({
  id,
  number: z.number().int(),
  diveDate: isoDate,
  entryTime: optionalText.describe('Local entry time as HH:MM:SS'),
  utcOffsetMinutes: z.number().int().nullable(),
  durationSeconds: z.number().int().nullable(),
  surfaceIntervalSeconds: z.number().int().nullable(),
  maximumDepthMeters: decimalString('metres'),
  averageDepthMeters: decimalString('metres'),
  airTemperatureCelsius: decimalString('degrees Celsius'),
  waterTemperatureCelsius: decimalString('degrees Celsius'),
  weightKg: decimalString('kilograms'),
  equipmentWeightKg: decimalString('kilograms'),
  maximumPpo2: decimalString('bar'),
  decompressionDive: z.boolean(),
  waterType: z.number().int().nullable(),
  entryType: z.number().int().nullable(),
  visibility: optionalText,
  current: optionalText,
  waves: optionalText,
  weather: optionalText,
  rating: z.number().int().nullable(),
  computer: optionalText,
  suit: optionalText,
  boatName: optionalText,
  shopName: optionalText,
  diveTypeName: optionalText,
  notes: optionalText,
  updatedAt: isoTimestamp,
  diver: z
    .looseObject({ id, firstName: optionalText, lastName: optionalText })
    .nullable(),
  site: z
    .looseObject({
      id,
      name: z.string(),
      country: optionalText,
      region: optionalText,
      waterName: optionalText,
      latitude: decimalString('decimal degrees'),
      longitude: decimalString('decimal degrees'),
      maximumDepthMeters: decimalString('metres'),
      altitudeMeters: z.number().int().nullable().describe('Whole metres'),
      difficulty: optionalText,
      rating: z.number().int().nullable(),
      notes: optionalText,
    })
    .nullable(),
  buddies: z.array(
    z.looseObject({
      id,
      firstName: optionalText,
      lastName: optionalText,
      email: optionalText,
      city: optionalText,
      country: optionalText,
      role: optionalText,
    }),
  ),
  equipment: z.array(
    z.looseObject({
      id,
      name: z.string(),
      category: optionalText,
      manufacturer: optionalText,
      model: optionalText,
    }),
  ),
  tanks: z.array(
    z.looseObject({
      id,
      name: optionalText,
      sortOrder: z.number().int().nullable(),
      computerTankNumber: z.number().int().nullable(),
      volumeLiters: decimalString('litres'),
      startPressureBar: decimalString('bar'),
      endPressureBar: decimalString('bar'),
      workingPressureBar: decimalString('bar'),
      oxygenPercent: decimalString('percent'),
      heliumPercent: decimalString('percent'),
      breathingTimeSeconds: z.number().int().nullable(),
      weightKg: decimalString('kilograms'),
    }),
  ),
  photos: z.array(pictureElement),
  signatures: z.array(pictureElement),
  sources: z.array(
    z.looseObject({
      integrationKey: optionalText,
      integrationName: optionalText,
      externalId: optionalText,
      identityKey: optionalText,
      externalUpdatedAt: isoTimestamp,
      lastSeenAt: isoTimestamp,
    }),
  ),
  // Assembled by the tool: samples are bounded by the caller's requested limit.
  profile: z.object({
    totalSamples: z.number().int(),
    returnedSamples: z.number().int(),
    truncated: z.boolean(),
    samples: z.array(
      z.looseObject({
        id,
        sampleIndex: z.number().int(),
        elapsedSeconds: z.number().int().nullable(),
        depthMeters: decimalString('metres'),
        temperatureCelsius: decimalString('degrees Celsius'),
        pressureBar: decimalString('bar'),
        tank1PressureBar: decimalString('bar'),
        tank2PressureBar: decimalString('bar'),
        decoCeilingMeters: decimalString('metres'),
        tankNumber: z.number().int().nullable(),
      }),
    ),
  }),
})

export const getGearItemOutput = z.looseObject({
  item: z.looseObject({
    id,
    diverId: optionalText,
    name: z.string(),
    category: optionalText,
    manufacturer: optionalText,
    model: optionalText,
    serialNumber: optionalText,
    information: optionalText,
    purchasedAt: isoDate,
    purchasePrice: decimalString('currency units'),
    purchaseShop: optionalText,
    retiredAt: isoDate,
    serviceDueAt: isoDate,
    inactive: z.boolean(),
    weightKg: decimalString('kilograms'),
    notes: optionalText,
    createdAt: isoTimestamp,
    updatedAt: isoTimestamp,
  }),
  dives: z.array(diveUsage),
  pictures: z.array(
    z.looseObject({
      id: z.string(),
      path: optionalText,
      storagePath: optionalText,
      thumbnailStoragePath: optionalText,
      description: optionalText,
    }),
  ),
})
