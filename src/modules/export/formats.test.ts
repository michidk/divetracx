import { describe, expect, test } from 'bun:test'
import { buildCsvExport, buildJsonExport, buildUddfExport } from './formats'
import type { ExportSnapshot } from './types'

function fixture(): ExportSnapshot {
  const timestamp = new Date('2026-08-29T10:15:00.000Z')
  return {
    format: 'divetracx-backup',
    version: 1,
    exportedAt: timestamp.toISOString(),
    data: {
      divers: [
        {
          id: 'diver-1',
          firstName: 'Ada & Grace',
          lastName: 'Diver',
          email: 'ada@example.test',
          phone: null,
          birthDate: null,
          bloodGroup: null,
          emergencyContact: null,
          emergencyPhone: null,
          insurance: null,
          notes: null,
          sourceKey: 'divemate',
          externalId: '1',
          externalUuid: null,
          sourceUpdatedAt: null,
          sourcePayload: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      diveSites: [
        {
          id: 'site-1',
          name: 'Blue, "Deep" Hole',
          country: 'Example & Co',
          region: null,
          waterName: 'Sea',
          latitude: '-24.1234567',
          longitude: '35.1234567',
          sourceLatitude: null,
          sourceLongitude: null,
          maximumDepthMeters: '40.00',
          altitudeMeters: 0,
          difficulty: null,
          rating: 5,
          waterType: 1,
          notes: 'Rock < arch',
          sourceKey: 'divemate',
          externalId: '7',
          externalUuid: null,
          sourceUpdatedAt: null,
          sourcePayload: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      buddies: [],
      equipment: [],
      certifications: [],
      shops: [],
      diveTypes: [],
      dives: [
        {
          id: 'dive-1',
          diverId: 'diver-1',
          siteId: 'site-1',
          shopId: null,
          diveTypeId: null,
          number: 42,
          diveDate: '2026-07-26',
          entryTime: '14:29:00',
          utcOffsetMinutes: 120,
          durationSeconds: 2910,
          surfaceIntervalSeconds: null,
          maximumDepthMeters: '31.20',
          averageDepthMeters: '16.40',
          airTemperatureCelsius: '26.00',
          waterTemperatureCelsius: '22.00',
          weightKg: '6.500',
          visibility: '15 m',
          current: 'low',
          waves: 'calm',
          weather: 'sunny',
          waterType: 1,
          entryType: 2,
          rating: 5,
          computer: 'Computer',
          suit: '5 mm',
          boat: 'Boat',
          divemaster: 'Guide',
          notes: '=HYPERLINK("bad")\notherwise memorable',
          sourceKey: 'divemate',
          externalId: '11',
          externalUuid: null,
          sourceUpdatedAt: null,
          sourcePayload: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      diveBuddies: [],
      diveEquipment: [],
      tanks: [],
      syncRuns: [],
    },
  }
}

describe('export formats', () => {
  test('creates a versioned native JSON backup', () => {
    const output = buildJsonExport(fixture())
    const parsed = JSON.parse(output) as {
      format: string
      version: number
      data: { dives: unknown[]; divers: Array<{ createdAt: string }> }
    }

    expect(parsed.format).toBe('divetracx-backup')
    expect(parsed.version).toBe(1)
    expect(parsed.data.dives).toHaveLength(1)
    expect(parsed.data.divers[0]?.createdAt).toBe('2026-08-29T10:15:00.000Z')
  })

  test('quotes CSV values and neutralizes formulas only in text fields', () => {
    const output = buildCsvExport(fixture())

    expect(output).toStartWith('\uFEFF"dive_number","date"')
    expect(output).toContain('"Blue, ""Deep"" Hole"')
    expect(output).toContain('"\'=HYPERLINK(""bad"")\notherwise memorable"')
    expect(output).toContain('"-24.1234567"')
    expect(output).toEndWith('\r\n')
  })

  test('creates escaped UDDF without inventing profile samples', () => {
    const output = buildUddfExport(fixture())

    expect(output).toContain(
      '<uddf xmlns="http://www.streit.cc/uddf/3.2/" version="3.2.3">',
    )
    expect(output).toContain('<firstname>Ada &amp; Grace</firstname>')
    expect(output).toContain('<name>Blue, &quot;Deep&quot; Hole</name>')
    expect(output).toContain('<datetime>2026-07-26T14:29:00+02:00</datetime>')
    expect(output).toContain('<greatestdepth>31.20</greatestdepth>')
    expect(output).toContain('<lowesttemperature>295.15</lowesttemperature>')
    expect(output).toContain('<diveduration>2910</diveduration>')
    expect(output).toContain('<notes>\n            <para>')
    expect(output).not.toContain('<samples>')
    expect(output).not.toContain('<waypoint>')
  })
})
