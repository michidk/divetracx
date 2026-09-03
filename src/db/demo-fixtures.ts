import type { PgliteDatabase } from 'drizzle-orm/pglite'
import * as schema from './schema'

type DemoDatabase = PgliteDatabase<typeof schema>
type ProfilePoint = readonly [
  elapsedSeconds: number,
  depthMeters: number,
  temperatureCelsius: number,
]

// These curves contain only time, depth, and temperature samples resampled from
// seven distinct real dives. Source IDs, dates, places, and other metadata must
// never be added to this public fixture.
const deepColdProfile: readonly ProfilePoint[] = [
  [0, 1.4, 21],
  [60, 7.6, 21],
  [120, 6.6, 21],
  [180, 4.7, 21],
  [240, 5.4, 21],
  [300, 8.4, 21],
  [360, 13.8, 19],
  [420, 17.8, 14],
  [480, 22, 11],
  [540, 28.6, 9],
  [600, 32.7, 7],
  [660, 36.6, 6],
  [720, 40.2, 6],
  [780, 39.3, 5],
  [840, 41.4, 5],
  [900, 43.9, 5],
  [960, 40.8, 4],
  [1020, 40.9, 4],
  [1080, 41.6, 4],
  [1140, 39.7, 4],
  [1200, 40.8, 4],
  [1260, 39.9, 4],
  [1320, 38.9, 4],
  [1380, 37.6, 4],
  [1440, 36.4, 4],
  [1500, 33.7, 4],
  [1560, 34.2, 4],
  [1620, 28.7, 4],
  [1680, 24, 4],
  [1740, 21.5, 4],
  [1800, 20.7, 5],
  [1860, 23.5, 5],
  [1920, 18.4, 5],
  [1980, 11, 5],
  [2040, 8.9, 7],
  [2100, 9.2, 10],
  [2160, 7.1, 12],
  [2220, 5.8, 15],
  [2280, 6.7, 17],
  [2340, 6.9, 18],
  [2400, 5.9, 19],
  [2460, 3.5, 20],
  [2520, 3.2, 20],
  [2580, 3.6, 20],
  [2640, 4, 20],
  [2700, 3.7, 21],
  [2760, 3.6, 21],
  [2820, 3.5, 21],
  [2880, 3.4, 21],
  [2940, 3.1, 21],
  [3000, 1.6, 21],
  [3060, 0, 21],
]

const warmReefProfile: readonly ProfilePoint[] = [
  [0, 1.4, 25],
  [60, 6.7, 24],
  [120, 7, 24],
  [180, 6.8, 24],
  [240, 7.8, 23],
  [300, 7, 23],
  [360, 11.7, 23],
  [420, 17.1, 21],
  [480, 20.3, 18],
  [540, 20.7, 14],
  [600, 21, 12],
  [660, 20.3, 11],
  [720, 21, 10],
  [780, 21.5, 9],
  [840, 24.6, 9],
  [900, 22.2, 8],
  [960, 23.4, 8],
  [1020, 20.5, 8],
  [1080, 21.1, 8],
  [1140, 17.4, 8],
  [1200, 18.4, 9],
  [1260, 14.3, 10],
  [1320, 15.9, 11],
  [1380, 14.2, 12],
  [1440, 14.7, 13],
  [1500, 15.8, 13],
  [1560, 16.7, 13],
  [1620, 14.3, 13],
  [1680, 13.4, 14],
  [1740, 11.1, 15],
  [1800, 10.5, 17],
  [1860, 8.9, 19],
  [1920, 6.5, 20],
  [1980, 6.2, 21],
  [2040, 3.2, 22],
  [2100, 2.7, 22],
  [2160, 2.6, 23],
  [2220, 2.7, 23],
  [2280, 3.1, 23],
  [2340, 1.6, 23],
  [2400, 0, 23],
]

const quarryProfile: readonly ProfilePoint[] = [
  [0, 2.2, 6.1],
  [60, 5.1, 5.6],
  [120, 7.4, 5.6],
  [180, 4.9, 5.6],
  [240, 7.7, 5.6],
  [300, 9.1, 5],
  [360, 9.4, 5.6],
  [420, 11.8, 5.6],
  [480, 13.3, 5.6],
  [540, 10.6, 5.6],
  [600, 13.8, 5],
  [660, 19.8, 5.6],
  [720, 20.1, 5],
  [780, 18.5, 5],
  [840, 13.8, 5],
  [900, 14, 5.6],
  [960, 9, 5],
  [1020, 3.2, 5],
  [1080, 3.8, 5],
  [1140, 3.4, 5],
  [1200, 2, 5.6],
  [1260, 2.2, 5.6],
]

const warmShallowProfile: readonly ProfilePoint[] = [
  [0, 1.6, 33.3],
  [60, 6.7, 32.8],
  [120, 7.4, 31.7],
  [180, 15.8, 30.6],
  [240, 15.1, 29.4],
  [300, 13.5, 28.9],
  [360, 11.9, 28.3],
  [420, 13.8, 27.2],
  [480, 11.9, 26.7],
  [540, 13, 26.7],
  [600, 13.6, 26.1],
  [660, 11.7, 26.1],
  [720, 10.3, 26.1],
  [780, 10.8, 25.6],
  [840, 9.7, 25.6],
  [900, 10.3, 25.6],
  [960, 10.2, 25.6],
  [1020, 10.4, 25.6],
  [1080, 14.8, 25.6],
  [1140, 12.4, 25.6],
  [1200, 11.1, 25.6],
  [1260, 11.2, 25.6],
  [1320, 10.6, 25],
  [1380, 10.5, 25],
  [1440, 12.6, 25],
  [1500, 12.1, 25],
  [1560, 10.4, 25],
  [1620, 10.7, 25],
  [1680, 12.3, 25],
  [1740, 13.7, 25],
  [1800, 8.4, 25],
  [1860, 10.1, 25],
  [1920, 10.1, 25],
  [1980, 8.9, 25],
  [2040, 8.9, 25],
  [2100, 11, 25.6],
  [2160, 12.3, 25],
  [2220, 15.1, 25],
  [2280, 17.3, 25],
  [2340, 14.5, 25],
  [2400, 15.1, 25],
  [2460, 13.6, 25],
  [2520, 15.1, 25],
  [2580, 14.6, 25],
  [2640, 12.5, 25],
  [2700, 12.5, 25],
  [2760, 12.6, 25],
  [2820, 13, 25],
  [2880, 13, 25],
  [2940, 11.4, 25],
  [3000, 12.2, 25],
  [3060, 11.7, 25],
  [3120, 7.4, 25],
  [3180, 9.5, 25.6],
  [3240, 10, 25],
  [3300, 5.5, 25.6],
  [3360, 5.2, 25.6],
  [3420, 3.9, 25.6],
  [3480, 4.5, 25.6],
  [3510, 2.1, 25.6],
]

const temperateReefProfile: readonly ProfilePoint[] = [
  [0, 0, 25],
  [60, 7, 24],
  [120, 11.8, 22],
  [180, 18.9, 21],
  [240, 20.6, 19],
  [300, 20.8, 18],
  [360, 18.6, 18],
  [420, 18.3, 18],
  [480, 18.2, 18],
  [540, 16.9, 18],
  [600, 16.2, 18],
  [660, 18.3, 18],
  [720, 18.2, 18],
  [780, 18.2, 18],
  [840, 18.8, 18],
  [900, 17.6, 18],
  [960, 18, 18],
  [1020, 19.4, 18],
  [1080, 20.9, 18],
  [1140, 18.9, 17],
  [1200, 17.5, 18],
  [1260, 16.1, 18],
  [1320, 17.7, 18],
  [1380, 19.4, 18],
  [1440, 18.6, 18],
  [1500, 18.5, 18],
  [1560, 17.3, 18],
  [1620, 16.8, 18],
  [1680, 16, 18],
  [1740, 16.4, 18],
  [1800, 18.3, 18],
  [1860, 16.2, 18],
  [1920, 15.6, 18],
  [1980, 14.5, 18],
  [2040, 15.2, 18],
  [2100, 14.9, 19],
  [2160, 14.5, 19],
  [2220, 12.6, 19],
  [2280, 13.1, 19],
  [2340, 12.4, 19],
  [2400, 10.6, 20],
  [2460, 8.5, 21],
  [2520, 4.9, 22],
  [2580, 3.1, 22],
  [2640, 5.2, 23],
  [2700, 2.4, 23],
  [2760, 3.6, 23],
  [2820, 3.1, 23],
  [2880, 3.3, 23],
  [2940, 2, 23],
  [3000, 2.3, 23],
  [3060, 1, 23],
  [3100, 1.3, 23],
]

const coldWreckProfile: readonly ProfilePoint[] = [
  [0, 2.4, 22.8],
  [60, 3.4, 22.2],
  [120, 4.9, 20.6],
  [180, 2.5, 19.4],
  [240, 5.6, 18.3],
  [300, 8.7, 17.8],
  [360, 11.6, 16.1],
  [420, 15.5, 14.4],
  [480, 18.2, 13.9],
  [540, 21.6, 12.2],
  [600, 26.3, 11.7],
  [660, 30.6, 10.6],
  [720, 30.8, 10],
  [780, 32.1, 8.9],
  [840, 31.5, 8.3],
  [900, 31.1, 7.2],
  [960, 28.4, 7.2],
  [1020, 28.9, 6.1],
  [1080, 28.3, 6.1],
  [1140, 25.2, 6.1],
  [1200, 23.6, 5.6],
  [1260, 23.4, 5.6],
  [1320, 20.6, 5.6],
  [1380, 19.9, 5],
  [1440, 20.5, 5],
  [1500, 18.1, 5.6],
  [1560, 12.9, 5.6],
  [1620, 10.8, 5.6],
  [1680, 9.8, 5.6],
  [1740, 7.2, 6.1],
  [1800, 3.7, 6.1],
  [1860, 4.6, 6.7],
  [1920, 4.8, 7.2],
  [1980, 3.8, 7.2],
  [2040, 4.4, 7.8],
  [2100, 5.6, 8.3],
  [2160, 4.2, 8.3],
  [2220, 4.1, 8.3],
  [2280, 5, 8.9],
  [2340, 6.7, 8.9],
  [2400, 2.8, 8.9],
  [2430, 3.6, 8.9],
]

const temperateKelpProfile: readonly ProfilePoint[] = [
  [0, 0, 24],
  [60, 10.7, 23],
  [120, 11.8, 20],
  [180, 13.1, 20],
  [240, 14.2, 19],
  [300, 12.6, 19],
  [360, 11.2, 19],
  [420, 9.2, 19],
  [480, 10.5, 19],
  [540, 10.8, 19],
  [600, 14.7, 19],
  [660, 16.5, 18],
  [720, 17.4, 18],
  [780, 15.1, 18],
  [840, 14.1, 18],
  [900, 13.7, 18],
  [960, 13.8, 18],
  [1020, 13.3, 19],
  [1080, 13.4, 18],
  [1140, 14, 18],
  [1200, 10.4, 18],
  [1260, 3.8, 19],
  [1320, 1.7, 21],
  [1380, 2.5, 22],
  [1440, 6.7, 22],
  [1500, 8.1, 21],
  [1560, 13.1, 20],
  [1620, 12.4, 19],
  [1680, 12.4, 19],
  [1740, 14, 19],
  [1800, 14, 18],
  [1860, 10.7, 19],
  [1920, 10.1, 19],
  [1980, 8.8, 19],
  [2040, 8.2, 19],
  [2100, 8, 20],
  [2160, 7.8, 20],
  [2220, 8.5, 20],
  [2280, 6.7, 20],
  [2340, 5.7, 21],
  [2400, 4.7, 22],
  [2460, 5.3, 22],
  [2520, 5, 22],
  [2580, 4.3, 22],
  [2640, 1.8, 22],
  [2700, 1.8, 23],
]

function dateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
}

function required<T>(value: T | undefined, message: string): T {
  if (value === undefined) throw new Error(message)
  return value
}

export async function seedDemoDatabase(database: DemoDatabase): Promise<void> {
  const [diver] = await database
    .insert(schema.divers)
    .values({
      firstName: 'Alex',
      lastName: 'Morgan',
      city: 'Demo Harbor',
      country: 'Sample Isles',
      notes: 'Fictional profile created for the Divetracx demo.',
    })
    .returning()
  const diverId = required(diver, 'Demo diver was not created').id

  const sites = await database
    .insert(schema.diveSites)
    .values([
      {
        name: 'Coral Lantern Reef',
        country: 'Sample Isles',
        region: 'South Cay',
        waterName: 'Azure Sea',
        latitude: '28.0721000',
        longitude: '-16.5123000',
        maximumDepthMeters: '28.00',
        difficulty: 'Easy',
        rating: 5,
        waterType: 1,
        notes: 'A fictional reef with sand channels and coral outcrops.',
      },
      {
        name: 'Azure Step Wall',
        country: 'Demo Republic',
        region: 'West Reach',
        waterName: 'Pelagic Sound',
        latitude: '36.0320000',
        longitude: '14.3150000',
        maximumDepthMeters: '48.00',
        difficulty: 'Advanced',
        rating: 5,
        waterType: 1,
        notes: 'A fictional wall used to showcase deeper profile data.',
      },
      {
        name: 'Silver Quarry',
        country: 'Demo Republic',
        region: 'Northmere',
        waterName: 'Quarry Lake',
        latitude: '50.4210000',
        longitude: '7.2840000',
        maximumDepthMeters: '24.00',
        altitudeMeters: 128,
        difficulty: 'Intermediate',
        rating: 4,
        waterType: 2,
        notes: 'A fictional freshwater training site.',
      },
      {
        name: 'Kelp Cathedral',
        country: 'Sample Isles',
        region: 'Windward Coast',
        waterName: 'Emerald Bay',
        latitude: '34.0190000',
        longitude: '-119.6830000',
        maximumDepthMeters: '22.00',
        difficulty: 'Intermediate',
        rating: 5,
        waterType: 1,
        notes: 'A fictional kelp forest with broad swim-throughs.',
      },
      {
        name: 'North Basin Wreck',
        country: 'Demo Republic',
        region: 'Bellweather',
        waterName: 'North Basin',
        latitude: '54.4870000',
        longitude: '10.2210000',
        maximumDepthMeters: '34.00',
        difficulty: 'Advanced',
        rating: 4,
        waterType: 1,
        notes: 'A fictional intact wreck resting upright on sand.',
      },
    ])
    .returning()
  const siteId = new Map(sites.map((site) => [site.name, site.id]))

  const buddies = await database
    .insert(schema.buddies)
    .values([
      { firstName: 'Maya', lastName: 'Reed', country: 'Sample Isles', minimumDives: 120 },
      {
        firstName: 'Jonas',
        lastName: 'Vale',
        country: 'Demo Republic',
        minimumDives: 85,
      },
      { firstName: 'Rin', lastName: 'Sol', country: 'Sample Isles', minimumDives: 240 },
    ])
    .returning()

  const [shop] = await database
    .insert(schema.shops)
    .values({ name: 'Tide & Current Dive Centre' })
    .returning()
  const shopId = required(shop, 'Demo shop was not created').id

  const types = await database
    .insert(schema.diveTypes)
    .values([
      { name: 'Recreational', sortOrder: 1 },
      { name: 'Wreck', sortOrder: 2 },
      { name: 'Deep', sortOrder: 3 },
      { name: 'Training', sortOrder: 4 },
    ])
    .returning()
  const typeId = new Map(types.map((type) => [type.name, type.id]))

  const gear = await database
    .insert(schema.equipment)
    .values([
      {
        diverId,
        name: 'Demo BCD',
        category: 'BCD',
        manufacturer: 'Northline',
        model: 'Current Wing',
      },
      {
        diverId,
        name: 'Demo regulator',
        category: 'Regulator',
        manufacturer: 'Northline',
        model: 'Atlas',
      },
      {
        diverId,
        name: 'Demo dive computer',
        category: 'Computer',
        manufacturer: 'Blue Arc',
        model: 'Tern',
      },
      {
        diverId,
        name: 'Demo drysuit',
        category: 'Exposure suit',
        manufacturer: 'Fieldwater',
        model: 'Fjord',
      },
    ])
    .returning()
  const [gearSet] = await database
    .insert(schema.equipmentSets)
    .values({ name: 'Cold-water single tank', notes: 'Fictional reusable demo setup.' })
    .returning()
  await database.insert(schema.equipmentSetItems).values(
    gear.map((item, sortOrder) => ({
      equipmentSetId: required(gearSet, 'Demo gear set was not created').id,
      equipmentId: item.id,
      sortOrder,
    })),
  )

  const builtInAgencies = await database.select().from(schema.agencies)
  const certificationAgency = builtInAgencies.find((agency) => agency.code === 'SSI')
  await database.insert(schema.certifications).values([
    {
      diverId,
      name: 'Open Water Diver',
      organization: certificationAgency?.name ?? 'Demo Diving Association',
      agencyId: certificationAgency?.id,
      certifiedAt: dateDaysAgo(900),
      sortOrder: 1,
    },
    {
      diverId,
      name: 'Deep Diving',
      organization: certificationAgency?.name ?? 'Demo Diving Association',
      agencyId: certificationAgency?.id,
      certifiedAt: dateDaysAgo(420),
      sortOrder: 2,
    },
  ])

  const diveFixtures = [
    {
      number: 1,
      daysAgo: 330,
      site: 'Coral Lantern Reef',
      type: 'Recreational',
      entryTime: '09:42:00',
      durationSeconds: 3510,
      maximumDepthMeters: '17.30',
      averageDepthMeters: '11.00',
      waterTemperatureCelsius: '25.00',
      rating: 5,
      oxygenPercent: '32.00',
      startPressureBar: '205.00',
      endPressureBar: '72.00',
      notes: 'Calm fictional reef dive with a long safety stop.',
    },
    {
      number: 2,
      daysAgo: 218,
      site: 'Kelp Cathedral',
      type: 'Recreational',
      entryTime: '11:18:00',
      durationSeconds: 3100,
      maximumDepthMeters: '20.90',
      averageDepthMeters: '13.40',
      waterTemperatureCelsius: '17.00',
      rating: 5,
      oxygenPercent: '32.00',
      startPressureBar: '210.00',
      endPressureBar: '68.00',
      notes: 'Fictional kelp circuit in light current.',
    },
    {
      number: 3,
      daysAgo: 126,
      site: 'Silver Quarry',
      type: 'Training',
      entryTime: '10:05:00',
      durationSeconds: 1260,
      maximumDepthMeters: '20.10',
      averageDepthMeters: '9.80',
      waterTemperatureCelsius: '5.00',
      rating: 4,
      oxygenPercent: '21.00',
      startPressureBar: '215.00',
      endPressureBar: '118.00',
      notes: 'Cold-water skills practice using an anonymized, resampled profile.',
    },
    {
      number: 4,
      daysAgo: 72,
      site: 'North Basin Wreck',
      type: 'Wreck',
      entryTime: '13:26:00',
      durationSeconds: 2430,
      maximumDepthMeters: '32.10',
      averageDepthMeters: '14.50',
      waterTemperatureCelsius: '5.00',
      rating: 4,
      oxygenPercent: '28.00',
      startPressureBar: '220.00',
      endPressureBar: '64.00',
      notes: 'Fictional exterior wreck survey.',
    },
    {
      number: 5,
      daysAgo: 31,
      site: 'Coral Lantern Reef',
      type: 'Recreational',
      entryTime: '08:54:00',
      durationSeconds: 2400,
      maximumDepthMeters: '24.60',
      averageDepthMeters: '14.80',
      waterTemperatureCelsius: '23.00',
      rating: 5,
      oxygenPercent: '32.00',
      startPressureBar: '205.00',
      endPressureBar: '76.00',
      notes: 'Warm-water demo dive using an anonymized, resampled profile.',
    },
    {
      number: 6,
      daysAgo: 14,
      site: 'Azure Step Wall',
      type: 'Deep',
      entryTime: '09:17:00',
      durationSeconds: 3060,
      maximumDepthMeters: '43.90',
      averageDepthMeters: '24.10',
      waterTemperatureCelsius: '4.00',
      rating: 5,
      oxygenPercent: '21.00',
      startPressureBar: '225.00',
      endPressureBar: '58.00',
      decompressionDive: true,
      notes: 'Deep demo dive using an anonymized, resampled profile.',
    },
    {
      number: 7,
      daysAgo: 3,
      site: 'Kelp Cathedral',
      type: 'Recreational',
      entryTime: '15:08:00',
      durationSeconds: 2700,
      maximumDepthMeters: '17.40',
      averageDepthMeters: '9.70',
      waterTemperatureCelsius: '18.00',
      rating: 5,
      oxygenPercent: '32.00',
      startPressureBar: '200.00',
      endPressureBar: '74.00',
      notes: 'Relaxed fictional afternoon dive.',
    },
  ] as const

  const createdDives = await database
    .insert(schema.dives)
    .values(
      diveFixtures.map((dive) => ({
        diverId,
        siteId: siteId.get(dive.site),
        shopId,
        diveTypeId: typeId.get(dive.type),
        captureSource: 'computer' as const,
        number: dive.number,
        diveDate: dateDaysAgo(dive.daysAgo),
        entryTime: dive.entryTime,
        utcOffsetMinutes: 0,
        durationSeconds: dive.durationSeconds,
        maximumDepthMeters: dive.maximumDepthMeters,
        averageDepthMeters: dive.averageDepthMeters,
        airTemperatureCelsius: '21.00',
        waterTemperatureCelsius: dive.waterTemperatureCelsius,
        decompressionDive: 'decompressionDive' in dive ? dive.decompressionDive : false,
        visibility: 'Good',
        current: 'Light',
        waves: 'Low',
        weather: 'Clear',
        waterType: dive.site === 'Silver Quarry' ? 2 : 1,
        rating: dive.rating,
        computer: 'Blue Arc Tern',
        suit:
          dive.site === 'Silver Quarry' || dive.site === 'Azure Step Wall'
            ? 'Drysuit'
            : '5 mm wetsuit',
        notes: dive.notes,
      })),
    )
    .returning()

  await database.insert(schema.tanks).values(
    createdDives.map((dive, index) => {
      const fixture = required(diveFixtures[index], 'Demo dive fixture missing')
      return {
        diveId: dive.id,
        name: 'Back gas',
        sortOrder: 0,
        computerTankNumber: 1,
        volumeLiters: fixture.type === 'Deep' ? '15.00' : '12.00',
        startPressureBar: fixture.startPressureBar,
        endPressureBar: fixture.endPressureBar,
        workingPressureBar: '232.00',
        oxygenPercent: fixture.oxygenPercent,
        heliumPercent: '0.00',
        breathingTimeSeconds: fixture.durationSeconds,
      }
    }),
  )

  await database.insert(schema.diveBuddies).values(
    createdDives.map((dive, index) => ({
      diveId: dive.id,
      buddyId: required(buddies[index % buddies.length], 'Demo buddy missing').id,
    })),
  )
  await database
    .insert(schema.diveEquipment)
    .values(
      createdDives.flatMap((dive) =>
        gear.map((item) => ({ diveId: dive.id, equipmentId: item.id })),
      ),
    )

  const profiles = new Map<number, readonly ProfilePoint[]>([
    [1, warmShallowProfile],
    [2, temperateReefProfile],
    [3, quarryProfile],
    [4, coldWreckProfile],
    [5, warmReefProfile],
    [6, deepColdProfile],
    [7, temperateKelpProfile],
  ])
  const samples = createdDives.flatMap((dive, index) => {
    const profile = profiles.get(index + 1)
    return profile
      ? profile.map(([elapsedSeconds, depthMeters, temperatureCelsius], sampleIndex) => ({
          diveId: dive.id,
          sampleIndex,
          elapsedSeconds,
          depthMeters: depthMeters.toFixed(2),
          temperatureCelsius: temperatureCelsius.toFixed(2),
          tankNumber: 1,
        }))
      : []
  })
  await database.insert(schema.diveProfileSamples).values(samples)

  await database.insert(schema.pictures).values([
    {
      diverId,
      kind: 'profile',
      path: 'profile-diver.webp',
      storagePath: 'demo/profile-diver.webp',
      mimeType: 'image/webp',
      description: 'Fictional demo diver portrait.',
      sortOrder: 0,
    },
    {
      diveId: required(createdDives[0], 'Demo reef dive missing').id,
      kind: 'photo',
      path: 'coral-lantern-reef.webp',
      storagePath: 'demo/coral-lantern-reef.webp',
      mimeType: 'image/webp',
      description: 'Coral outcrops and sand channels at Coral Lantern Reef.',
      sortOrder: 0,
    },
    {
      diveId: required(createdDives[3], 'Demo wreck dive missing').id,
      kind: 'photo',
      path: 'north-basin-wreck.webp',
      storagePath: 'demo/north-basin-wreck.webp',
      mimeType: 'image/webp',
      description: 'The fictional North Basin Wreck resting upright on sand.',
      sortOrder: 0,
    },
    {
      diveId: required(createdDives[5], 'Demo wall dive missing').id,
      kind: 'photo',
      path: 'azure-step-wall.webp',
      storagePath: 'demo/azure-step-wall.webp',
      mimeType: 'image/webp',
      description: 'Rock ledges descending into blue water at Azure Step Wall.',
      sortOrder: 0,
    },
  ])
}
