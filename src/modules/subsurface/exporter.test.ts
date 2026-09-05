import { describe, expect, test } from 'bun:test'
import type { ExportSnapshot } from '@/modules/export/types'
import { buildSubsurfaceExport } from './exporter'
import { parseSubsurfaceLogbook } from './parser'

function fixture(): ExportSnapshot {
  const timestamp = new Date('2026-08-29T10:15:00.000Z')
  return {
    format: 'divetracx-backup',
    version: 17,
    exportedAt: timestamp.toISOString(),
    data: {
      agencies: [],
      divers: [],
      diveSites: [
        {
          id: 'site-1',
          name: "Jake's <Plane>",
          country: 'Palau',
          region: 'Koror',
          waterName: 'Pacific',
          latitude: '7.3689140',
          longitude: '134.4483640',
          maximumDepthMeters: null,
          altitudeMeters: null,
          difficulty: null,
          rating: null,
          waterType: 1,
          notes: 'Wreck & reef',
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: 'site-unused',
          name: 'Never dived',
          country: null,
          region: null,
          waterName: null,
          latitude: null,
          longitude: null,
          maximumDepthMeters: null,
          altitudeMeters: null,
          difficulty: null,
          rating: null,
          waterType: null,
          notes: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      buddies: [
        {
          id: 'buddy-1',
          firstName: 'Sam',
          lastName: 'Buddy',
          email: null,
          phone: null,
          street: null,
          postalCode: null,
          city: null,
          state: null,
          country: null,
          instructor: false,
          minimumDives: null,
          emergencyContact: null,
          emergencyPhone: null,
          emergencyEmail: null,
          notes: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: 'buddy-2',
          firstName: 'Dana',
          lastName: 'Guide',
          email: null,
          phone: null,
          street: null,
          postalCode: null,
          city: null,
          state: null,
          country: null,
          instructor: true,
          minimumDives: null,
          emergencyContact: null,
          emergencyPhone: null,
          emergencyEmail: null,
          notes: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      buddyCertifications: [],
      buddyAgencyMemberships: [],
      equipment: [],
      equipmentSets: [],
      equipmentSetItems: [],
      certifications: [],
      agencyMemberships: [],
      shops: [],
      boats: [],
      diveTypes: [
        {
          id: 'type-1',
          name: 'Wreck',
          sortOrder: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      dives: [
        {
          id: 'dive-1',
          captureSource: 'computer',
          diverId: null,
          siteId: 'site-1',
          shopId: null,
          boatId: null,
          diveTypeId: 'type-1',
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
          equipmentWeightKg: null,
          maximumPpo2: null,
          decompressionDive: true,
          safetyStop: false,
          safetyStopSeconds: null,
          pressureGroupBeforeInterval: null,
          pressureGroupAfterInterval: null,
          pressureGroupEnd: null,
          residualNitrogenSeconds: null,
          visibility: '15 m',
          current: null,
          waves: null,
          weather: null,
          waterType: 1,
          entryType: 2,
          rating: 5,
          computer: 'Shearwater Perdix',
          suit: '5 mm',
          notes: "Great dive <with> Sam & Dana's team",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: 'dive-2',
          captureSource: 'manual',
          diverId: null,
          siteId: null,
          shopId: null,
          boatId: null,
          diveTypeId: null,
          number: null,
          diveDate: '2026-07-27',
          entryTime: null,
          utcOffsetMinutes: null,
          durationSeconds: 0,
          surfaceIntervalSeconds: null,
          maximumDepthMeters: null,
          averageDepthMeters: null,
          airTemperatureCelsius: null,
          waterTemperatureCelsius: null,
          weightKg: null,
          equipmentWeightKg: null,
          maximumPpo2: null,
          decompressionDive: false,
          safetyStop: false,
          safetyStopSeconds: null,
          pressureGroupBeforeInterval: null,
          pressureGroupAfterInterval: null,
          pressureGroupEnd: null,
          residualNitrogenSeconds: null,
          visibility: null,
          current: null,
          waves: null,
          weather: null,
          waterType: null,
          entryType: null,
          rating: null,
          computer: null,
          suit: null,
          notes: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      diveBuddies: [
        { id: 'db-1', diveId: 'dive-1', buddyId: 'buddy-1', role: 'buddy' },
        { id: 'db-2', diveId: 'dive-1', buddyId: 'buddy-2', role: 'instructor' },
      ],
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
        {
          id: 'sample-3',
          diveId: 'dive-1',
          sampleIndex: 2,
          elapsedSeconds: 2910,
          depthMeters: '0.00',
          temperatureCelsius: '19.50',
          pressureBar: null,
          tank1PressureBar: null,
          tank2PressureBar: null,
          decoCeilingMeters: null,
          tankNumber: 2,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      tanks: [
        {
          id: 'tank-1',
          diveId: 'dive-1',
          name: 'AL80',
          sortOrder: 0,
          computerTankNumber: 1,
          volumeLiters: '11.10',
          startPressureBar: '205.00',
          endPressureBar: '60.00',
          workingPressureBar: '207.00',
          oxygenPercent: '32.00',
          heliumPercent: '0.00',
          breathingTimeSeconds: null,
          weightKg: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: 'tank-2',
          diveId: 'dive-1',
          name: 'Deco 50',
          sortOrder: 1,
          computerTankNumber: 2,
          volumeLiters: '7.00',
          startPressureBar: '200.00',
          endPressureBar: '150.00',
          workingPressureBar: null,
          oxygenPercent: '50.00',
          heliumPercent: null,
          breathingTimeSeconds: null,
          weightKg: null,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      pictures: [],
      importRuns: [],
    },
  }
}

describe('buildSubsurfaceExport', () => {
  test('writes the native Subsurface v3 layout with escaped values and SI units', () => {
    const output = buildSubsurfaceExport(fixture())

    expect(output).toStartWith("<divelog program='subsurface' version='3'>\n")
    expect(output).toContain(
      "name='Jake&apos;s &lt;Plane&gt;' gps='7.368914 134.448364'>",
    )
    expect(output).toContain("<geo cat='2' origin='2' value='Palau'/>")
    expect(output).not.toContain('Never dived')
    expect(output).toContain(
      "<dive number='42' rating='5' tags='wreck, boat, deco' divesiteid='",
    )
    expect(output).toContain(
      "watersalinity='1030 g/l' date='2026-07-26' time='14:29:00' duration='48:30 min'>",
    )
    expect(output).toContain('<divemaster>Instructor: Dana Guide</divemaster>')
    expect(output).not.toContain("visibility='")
    expect(output).toContain('<buddy>Sam Buddy</buddy>')
    expect(output).toContain(
      '<notes>Great dive &lt;with&gt; Sam &amp; Dana&apos;s team\n\nVisibility: 15 m</notes>',
    )
    expect(output).toContain(
      "<cylinder size='11.1 l' workpressure='207.0 bar' description='AL80' o2='32.0%' start='205.0 bar' end='60.0 bar' />",
    )
    expect(output).toContain(
      "<cylinder size='7.0 l' description='Deco 50' o2='50.0%' start='200.0 bar' end='150.0 bar' />",
    )
    expect(output).toContain("<weightsystem weight='6.5 kg' description='weight' />")
    expect(output).toContain("<divecomputer model='Shearwater Perdix'>")
    expect(output).toContain("<depth max='31.2 m' mean='16.4 m' />")
    expect(output).toContain("<temperature air='26.0 C' water='22.0 C' />")
    expect(output).toContain(
      "<event time='0:30 min' type='25' name='gaschange' cylinder='1' o2='50.0%' />",
    )
    expect(output).toContain(
      "<sample time='0:00 min' depth='0.0 m' temp='22.0 C' pressure0='205.0 bar' pressure1='198.0 bar' />",
    )
    expect(output).toContain(
      "<sample time='0:30 min' depth='12.3 m' temp='19.5 C' pressure0='194.0 bar' pressure1='198.5 bar' in_deco='1' stopdepth='3.0 m' />",
    )
    expect(output).toContain(
      "<sample time='48:30 min' depth='0.0 m' in_deco='0' stopdepth='0.0 m' />",
    )
    expect(output).toContain("<dive date='2026-07-27' time='00:00:00'>\n</dive>")
    expect(output).toEndWith('</divelog>\n')
  })

  test('round-trips through the Subsurface parser', () => {
    const logbook = parseSubsurfaceLogbook(buildSubsurfaceExport(fixture()))

    expect(logbook.formatVersion).toBe(3)
    expect(logbook.sites).toHaveLength(1)
    expect(logbook.sites[0]).toMatchObject({
      name: "Jake's <Plane>",
      latitude: 7.368914,
      longitude: 134.448364,
      country: 'Palau',
      region: 'Koror',
      waterName: 'Pacific',
      notes: 'Wreck & reef',
    })
    expect(logbook.dives).toHaveLength(2)
    const [dive, minimal] = logbook.dives
    expect(dive).toMatchObject({
      number: 42,
      diveDate: '2026-07-26',
      entryTime: '14:29:00',
      durationSeconds: 2910,
      maximumDepthMeters: 31.2,
      averageDepthMeters: 16.4,
      airTemperatureCelsius: 26,
      waterTemperatureCelsius: 22,
      weightKg: 6.5,
      rating: 5,
      waterType: 1,
      entryType: 2,
      tags: ['wreck', 'boat', 'deco'],
      suit: '5 mm',
      computer: 'Shearwater Perdix',
      decompressionDive: true,
    })
    expect(dive?.people).toEqual([
      { name: 'Sam Buddy', role: 'buddy' },
      { name: 'Dana Guide', role: 'instructor' },
    ])
    expect(dive?.cylinders.map((cylinder) => cylinder.oxygenPercent)).toEqual([32, 50])
    expect(dive?.samples).toEqual([
      {
        elapsedSeconds: 0,
        depthMeters: 0,
        temperatureCelsius: 22,
        pressureBar: 205,
        tank1PressureBar: 205,
        tank2PressureBar: 198,
        decoCeilingMeters: null,
        tankNumber: 1,
      },
      {
        elapsedSeconds: 30,
        depthMeters: 12.3,
        temperatureCelsius: 19.5,
        pressureBar: 198.5,
        tank1PressureBar: 194,
        tank2PressureBar: 198.5,
        decoCeilingMeters: 3,
        tankNumber: 2,
      },
      {
        elapsedSeconds: 2910,
        depthMeters: 0,
        temperatureCelsius: 19.5,
        pressureBar: null,
        tank1PressureBar: null,
        tank2PressureBar: null,
        decoCeilingMeters: null,
        tankNumber: 2,
      },
    ])
    expect(minimal).toMatchObject({
      diveDate: '2026-07-27',
      entryTime: '00:00:00',
      durationSeconds: 0,
      siteExternalId: null,
      computer: null,
    })
  })
})
