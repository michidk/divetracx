import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseSubsurfaceLogbook, SubsurfaceParseError } from './parser'

function fixture(name: string) {
  return readFileSync(join(import.meta.dir, 'fixtures', name), 'utf8')
}

function parse(name: string) {
  return parseSubsurfaceLogbook(fixture(name))
}

describe('parseSubsurfaceLogbook', () => {
  describe('legacy <dives> files (format 1)', () => {
    test('reads a minimal dive with an inline location', () => {
      const logbook = parse('test1.xml')

      expect(logbook.formatVersion).toBe(1)
      expect(logbook.dives).toHaveLength(1)
      expect(logbook.dives[0]).toMatchObject({
        externalId: '2011-01-01T09:00:00',
        number: 1,
        diveDate: '2011-01-01',
        entryTime: '09:00:00',
        durationSeconds: 1800,
        maximumDepthMeters: 30,
        averageDepthMeters: 15,
        notes: 'Yes, the previous dive is dive 0, that one with no location.',
        computer: null,
      })
      expect(logbook.sites).toEqual([
        {
          externalId: 'name:first test dive, this one with location',
          name: 'First test dive, this one with location',
          latitude: null,
          longitude: null,
          country: null,
          region: null,
          waterName: null,
          notes: null,
        },
      ])
      expect(logbook.dives[0]?.siteExternalId).toBe(logbook.sites[0]?.externalId)
    })

    test('maps legacy gas-change events by oxygen percentage', () => {
      const [dive] = parse('test7.xml').dives

      expect(dive?.cylinders).toEqual([
        {
          sortOrder: 0,
          description: 'AL72',
          volumeLiters: 9.987,
          workingPressureBar: 206.843,
          startPressureBar: 200,
          endPressureBar: 100,
          oxygenPercent: 33,
          heliumPercent: null,
        },
        expect.objectContaining({ sortOrder: 1, oxygenPercent: 50 }),
      ])
      expect(dive).toMatchObject({
        airTemperatureCelsius: 27,
        waterTemperatureCelsius: 26,
      })
    })

    test('carries sample temperatures forward, tracks tank switches, and reads <gps>', () => {
      const logbook = parse('test13.xml')
      const [dive] = logbook.dives

      expect(logbook.sites[0]).toMatchObject({ latitude: 27.40835, longitude: 33.87772 })
      expect(dive?.samples).toHaveLength(30)
      expect(dive?.samples[0]).toEqual({
        elapsedSeconds: 60,
        depthMeters: 5,
        temperatureCelsius: 27,
        pressureBar: null,
        tank1PressureBar: null,
        tank2PressureBar: null,
        decoCeilingMeters: null,
        tankNumber: 1,
      })
      expect(dive?.samples[8]).toMatchObject({
        elapsedSeconds: 540,
        temperatureCelsius: 23,
        tankNumber: 1,
      })
      expect(dive?.samples[9]).toMatchObject({ elapsedSeconds: 600, tankNumber: 2 })
      const tankNumbers = dive?.samples.map((sample) => sample.tankNumber) ?? []
      expect(tankNumbers.at(-1)).toBe(1)
      expect(tankNumbers).toContain(3)
    })

    test('reads trimix cylinders and pressures written without decimals', () => {
      const [dive] = parse('test20.xml').dives
      expect(dive?.cylinders[0]).toMatchObject({
        oxygenPercent: 21,
        heliumPercent: 30,
        startPressureBar: 200,
      })
      expect(dive?.maximumDepthMeters).toBe(70)
    })

    test('collects dives inside and outside trips and pads unpadded times', () => {
      const logbook = parse('test23.xml')
      expect(logbook.diagnostics.tripsSeen).toBe(1)
      expect(logbook.dives.map((dive) => [dive.number, dive.entryTime])).toEqual([
        [23, '06:00:00'],
        [22, '07:00:00'],
      ])
    })

    test('reads a <divecomputer> block and salinity inside a legacy dive', () => {
      const [dive] = parse('test26.xml').dives
      expect(dive).toMatchObject({
        computer: 'Model Product',
        waterType: 2,
        maximumDepthMeters: 24.3,
        averageDepthMeters: 12.773,
      })
      expect(dive?.samples).toHaveLength(6)
      expect(dive?.samples[1]).toMatchObject({
        depthMeters: 20,
        temperatureCelsius: 24.2,
      })
      expect(dive?.samples[2]?.temperatureCelsius).toBe(24.2)
    })
  })

  describe('<divelog> version 2 files', () => {
    test('uses the O2 encoded in typed gas-change events and ignores other events', () => {
      const [dive] = parse('test30.xml').dives
      expect(dive?.computer).toBeNull()
      expect(dive?.samples.map((sample) => sample.tankNumber)).toEqual([
        2, 2, 1, 2, 2, 2, 2,
      ])
    })

    test('creates sites from <location> elements and merges duplicates by name', () => {
      const logbook = parse('test50.xml')

      expect(logbook.formatVersion).toBe(2)
      expect(logbook.dives.map((dive) => dive.diveDate)).toEqual([
        '2015-01-01',
        '2015-01-02',
        '2015-01-03',
      ])
      expect(logbook.sites.map((site) => site.name)).toEqual([
        'Blue Corner',
        'Yellow Corner',
      ])
      expect(logbook.dives[2]?.siteExternalId).toBe(logbook.dives[0]?.siteExternalId)
    })

    test('names GPS-only locations by their coordinates', () => {
      const logbook = parse('tank_pressure.xml')
      expect(logbook.sites).toEqual([
        {
          externalId: 'gps:-15.815569,-47.796887',
          name: '-15.81557, -47.79689',
          latitude: -15.815569,
          longitude: -47.796887,
          country: null,
          region: null,
          waterName: null,
          notes: null,
        },
      ])
      expect(logbook.dives[0]?.samples.map((sample) => sample.tankNumber)).toEqual([
        1, 2, 1, 2, 1, 1,
      ])
    })

    test('accepts the .ssrf spelling and keeps distinct site names apart', () => {
      const logbook = parse('TwoTimesTwo.ssrf')
      expect(logbook.dives).toHaveLength(4)
      expect(logbook.sites.map((site) => site.name)).toEqual([
        'Blue Corner',
        'Blue Corner, Palau',
      ])
    })
  })

  describe('<divelog> version 3 files', () => {
    test('reads the full CCR dive from test42', () => {
      const logbook = parse('test42.xml')
      const [dive] = logbook.dives

      expect(logbook.sites).toEqual([
        {
          externalId: 'ec2bbc32',
          name: 'Lake Coleridge',
          latitude: -43.342295,
          longitude: 171.545936,
          country: null,
          region: null,
          waterName: null,
          notes: null,
        },
      ])
      expect(dive).toMatchObject({
        number: 1,
        diveDate: '2014-04-02',
        entryTime: '10:00:00',
        durationSeconds: 4674,
        maximumDepthMeters: 38.99,
        averageDepthMeters: 17.72,
        airTemperatureCelsius: 12.2,
        waterTemperatureCelsius: 4.3,
        weightKg: 2,
        rating: 4,
        visibility: 4,
        waterType: 2,
        tags: ['ccr_dive'],
        suit: 'dry suit',
        computer: 'Heinrichs Weikamp OSTC 3',
        notes: 'CCR dive\nLake\n"small waves"',
        decompressionDive: true,
        siteExternalId: 'ec2bbc32',
      })
      expect(dive?.people).toEqual([
        { name: 'Michael', role: 'buddy' },
        { name: 'Taylor', role: 'divemaster' },
      ])
      expect(dive?.cylinders).toHaveLength(3)
      expect(dive?.cylinders[0]).toMatchObject({
        description: 'Dil2',
        oxygenPercent: 16,
        heliumPercent: 45,
      })
      expect(dive?.samples).toHaveLength(2485)
      expect(dive?.samples.some((sample) => sample.decoCeilingMeters !== null)).toBe(true)
    })

    test('imports dives without numbers and resolves divesiteid references', () => {
      const logbook = parse('test47c.xml')
      expect(logbook.dives.map((dive) => [dive.number, dive.siteExternalId])).toEqual([
        [null, 'cb2d5719'],
        [null, '4f6eef08'],
      ])
      expect(logbook.dives[0]?.samples).toHaveLength(6)
    })

    test('reads a minimal v3 file without settings', () => {
      const logbook = parse('test48.xml')
      expect(logbook.dives[0]).toMatchObject({
        tags: ['test'],
        maximumDepthMeters: 13.716,
        durationSeconds: 2760,
        siteExternalId: '15ae02d1',
      })
    })

    test('follows explicit cylinder indexes in gas changes and long durations', () => {
      const [dive] = parse('test51.xml').dives
      expect(dive?.durationSeconds).toBe(123 * 60 + 30)
      expect(dive?.cylinders).toHaveLength(5)
      const active = new Map(
        dive?.samples.map((sample) => [sample.elapsedSeconds, sample.tankNumber]),
      )
      expect(active.get(0)).toBe(1)
      expect(active.get(601)).toBe(3)
      expect(active.get(841)).toBe(4)
      expect(dive?.samples[0]?.pressureBar).toBe(206.843)
    })

    test('reads weights, salinity, trips, and pressure from a real computer', () => {
      const logbook = parse('TestAtmPress.xml')
      expect(logbook.diagnostics.tripsSeen).toBe(1)
      expect(logbook.dives[0]).toMatchObject({
        number: 524,
        weightKg: 3,
        waterType: 1,
        computer: 'Uwatec Galileo Trimix',
        airTemperatureCelsius: 24.6,
        waterTemperatureCelsius: 23.2,
      })
      expect(logbook.dives[0]?.cylinders[0]?.description).toBe('10ℓ 232 bar')
      expect(logbook.dives[0]?.samples.at(-1)).toMatchObject({
        pressureBar: 208.25,
        tank1PressureBar: 208.25,
      })
    })

    test('maps multi-sensor pressures to tank columns', () => {
      const [dive] = parse('test-tank-sensors.xml').dives
      expect(dive?.samples[1]).toMatchObject({
        tank1PressureBar: 109.213,
        tank2PressureBar: 159.407,
        pressureBar: 109.213,
        tankNumber: 1,
      })
      expect(dive?.samples.at(-1)?.tankNumber).toBe(3)
    })

    test('keeps dives that have neither duration nor depth', () => {
      const logbook = parse('DL7.xml')
      expect(logbook.dives.map((dive) => dive.durationSeconds)).toEqual([0, 3600, 0])
      expect(logbook.dives[0]).toMatchObject({
        maximumDepthMeters: null,
        airTemperatureCelsius: 27,
        waterTemperatureCelsius: 25,
      })
    })

    test('disambiguates dives that share a start instant', () => {
      const xml = `<divelog program='subsurface' version='3'><dives>
        <dive date='2020-01-01' time='10:00:00' duration='10:00 min'></dive>
        <dive date='2020-01-01' time='10:00:00' duration='12:00 min'></dive>
      </dives></divelog>`
      expect(parseSubsurfaceLogbook(xml).dives.map((dive) => dive.externalId)).toEqual([
        '2020-01-01T10:00:00',
        '2020-01-01T10:00:00#2',
      ])
    })
  })

  describe('rejections', () => {
    test('rejects files that are not Subsurface logbooks', () => {
      expect(() => parseSubsurfaceLogbook('<uddf version="3.2.0"></uddf>')).toThrow(
        SubsurfaceParseError,
      )
      expect(() => parseSubsurfaceLogbook('<divelog program="other"></divelog>')).toThrow(
        /not written by Subsurface/,
      )
      expect(() => parseSubsurfaceLogbook('not xml at all')).toThrow(SubsurfaceParseError)
      expect(() =>
        parseSubsurfaceLogbook('<dives><dive date="2020-01-01"></dives>'),
      ).toThrow(/well-formed/)
    })

    test('rejects documents with a DOCTYPE', () => {
      expect(() =>
        parseSubsurfaceLogbook(
          `<!DOCTYPE divelog [<!ENTITY x SYSTEM "file:///etc/passwd">]><divelog program='subsurface'><dives/></divelog>`,
        ),
      ).toThrow(/DOCTYPE/)
    })

    test('skips dives without a valid date', () => {
      const logbook = parseSubsurfaceLogbook(
        `<divelog program='subsurface' version='3'><dives><dive time='10:00:00'/><dive date='2020-13-40'/></dives></divelog>`,
      )
      expect(logbook.dives).toHaveLength(0)
      expect(logbook.diagnostics.divesSkipped).toBe(2)
    })
  })
})
