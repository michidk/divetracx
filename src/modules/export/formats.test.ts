import { describe, expect, test } from 'bun:test'
import { buildCsvExport, buildJsonExport, buildUddfExport } from './formats'
import type { ExportSnapshot } from './types'

function fixture(): ExportSnapshot {
  const timestamp = new Date('2026-08-29T10:15:00.000Z')
  return {
    format: 'divetracx-backup',
    version: 7,
    exportedAt: timestamp.toISOString(),
    data: {
      divers: [
        {
          id: 'diver-1',
          firstName: 'Ada & Grace',
          lastName: 'Diver',
          email: 'ada@example.test',
          phone: null,
          street: null,
          postalCode: null,
          city: null,
          state: null,
          country: null,
          birthDate: null,
          bloodGroup: null,
          emergencyContact: null,
          emergencyPhone: null,
          emergencyEmail: null,
          insurance: null,
          notes: null,
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
          maximumDepthMeters: '40.00',
          altitudeMeters: 0,
          difficulty: null,
          rating: 5,
          waterType: 1,
          notes: 'Rock < arch',
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
          captureSource: 'computer' as const,
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
          equipmentWeightKg: '12.400',
          maximumPpo2: '1.176000',
          decompressionDive: true,
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
          legacyBuddyText: 'Buddy note',
          notes: '=HYPERLINK("bad")\notherwise memorable',
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      diveBuddies: [],
      diveEquipment: [],
      diveProfileSamples: [
        {
          id: 'sample-1',
          diveId: 'dive-1',
          sampleIndex: 0,
          elapsedSeconds: 0,
          depthMeters: '0.00',
          temperatureCelsius: '22.00',
          pressureBar: '205.00',
          tank1PressureBar: '205.00',
          tank2PressureBar: '198.00',
          decoCeilingMeters: null,
          tankNumber: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: 'sample-2',
          diveId: 'dive-1',
          sampleIndex: 1,
          elapsedSeconds: 30,
          depthMeters: '12.30',
          temperatureCelsius: '19.50',
          pressureBar: '198.50',
          tank1PressureBar: '194.00',
          tank2PressureBar: '198.50',
          decoCeilingMeters: '3.00',
          tankNumber: 2,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      tanks: [],
      pictures: [],
      importRuns: [],
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
    expect(parsed.version).toBe(7)
    expect(parsed.data.dives).toHaveLength(1)
    expect(parsed.data.divers[0]?.createdAt).toBe('2026-08-29T10:15:00.000Z')
  })

  test('quotes CSV values and neutralizes formulas only in text fields', () => {
    const output = buildCsvExport(fixture())

    expect(output).toStartWith('\uFEFF"dive_number","date"')
    expect(output).toContain('"Blue, ""Deep"" Hole"')
    expect(output).toContain('"\'=HYPERLINK(""bad"")\notherwise memorable"')
    expect(output).toContain('"-24.1234567"')
    expect(output).toContain(
      '"2","0:0.00:22.00:205.00:205.00:198.00::1;30:12.30:19.50:198.50:194.00:198.50:3.00:2"',
    )
    expect(output).toEndWith('\r\n')
  })

  test('creates escaped UDDF with real profile samples', () => {
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
    expect(output).toContain('<samples>')
    expect(output).toContain('<divetime>30</divetime>')
    expect(output).toContain('<depth>12.30</depth>')
  })
})
