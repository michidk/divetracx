import { describe, expect, test } from 'bun:test'
import {
  DiveMergeError,
  type MergeDiveInput,
  type MergeSample,
  type MergeTank,
  mergeTanks,
  planDiveMerge,
  summariseProfile,
} from './merge'

function dive(overrides: Partial<MergeDiveInput> & { id: string }): MergeDiveInput {
  return {
    number: null,
    diveDate: '2024-06-01',
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
    siteId: null,
    siteName: null,
    shopId: null,
    boatId: null,
    diveTypeId: null,
    diverId: null,
    ...overrides,
  }
}

function ramp(depths: number[], step = 60): MergeSample[] {
  return depths.map((depth, index) => ({
    elapsedSeconds: index * step,
    depthMeters: depth.toFixed(2),
  }))
}

function tank(overrides: Partial<MergeTank> & { id: string }): MergeTank {
  return {
    name: null,
    sortOrder: 0,
    computerTankNumber: null,
    volumeLiters: null,
    startPressureBar: null,
    endPressureBar: null,
    workingPressureBar: null,
    oxygenPercent: null,
    heliumPercent: null,
    breathingTimeSeconds: null,
    weightKg: null,
    ...overrides,
  }
}

describe('planDiveMerge', () => {
  test('offsets a later segment by its real clock gap', () => {
    const keeper = {
      dive: dive({
        id: 'a',
        number: 41,
        entryTime: '10:00:00',
        durationSeconds: 1800,
        maximumDepthMeters: '28.40',
      }),
      samples: ramp([0, 20, 28, 10]),
    }
    const source = {
      dive: dive({
        id: 'b',
        number: 42,
        entryTime: '10:45:00',
        durationSeconds: 1200,
        maximumDepthMeters: '18.00',
      }),
      samples: ramp([0, 12, 18]),
    }

    const plan = planDiveMerge([keeper, source])

    expect(plan.segments.map((segment) => segment.dive.id)).toEqual(['a', 'b'])
    // 10:45 is 2700 s after 10:00, and the first segment ran 1800 s.
    expect(plan.segments[1]?.offsetSeconds).toBe(2700)
    expect(plan.segments[1]?.gapSeconds).toBe(900)
    expect(plan.durationSeconds).toBe(2700 + 1200)
    expect(plan.fields.maximumDepthMeters).toBe('28.40')
  })

  test('normalises entry times through their UTC offsets', () => {
    const keeper = {
      dive: dive({
        id: 'a',
        entryTime: '10:00:00',
        utcOffsetMinutes: 120,
        durationSeconds: 600,
      }),
      samples: [],
    }
    const source = {
      dive: dive({
        id: 'b',
        entryTime: '09:30:00',
        utcOffsetMinutes: 60,
        durationSeconds: 600,
      }),
      samples: [],
    }

    // 09:30+01:00 is 08:30 UTC, half an hour after 10:00+02:00 is 08:00 UTC.
    const plan = planDiveMerge([keeper, source])
    expect(plan.segments[1]?.offsetSeconds).toBe(1800)
  })

  test('keeps the earliest dive, whichever the merge was started from', () => {
    const opened = {
      dive: dive({ id: 'a', number: 42, entryTime: '11:00:00', durationSeconds: 600 }),
      samples: [],
    }
    const earlier = {
      dive: dive({
        id: 'b',
        number: 41,
        entryTime: '09:00:00',
        durationSeconds: 600,
        surfaceIntervalSeconds: 3600,
      }),
      samples: [],
    }

    const plan = planDiveMerge([opened, earlier])

    // The dive began at 09:00, so #41 is the one that survives.
    expect(plan.keeperId).toBe('b')
    expect(plan.segments.map((segment) => segment.dive.id)).toEqual(['b', 'a'])
    expect(plan.fields.entryTime).toBe('09:00:00')
    // The interval before the merged dive is the earliest segment's.
    expect(plan.fields.surfaceIntervalSeconds).toBe(3600)
  })

  test('lets the surviving dive win on conflicting details', () => {
    const opened = {
      dive: dive({ id: 'a', entryTime: '11:00:00', suit: '7 mm', weather: 'Rain' }),
      samples: [],
    }
    const earlier = {
      dive: dive({ id: 'b', entryTime: '09:00:00', suit: '5 mm' }),
      samples: [],
    }

    const plan = planDiveMerge([opened, earlier])

    expect(plan.keeperId).toBe('b')
    // The earlier dive's own value stands...
    expect(plan.fields.suit).toBe('5 mm')
    // ...and a field it never recorded is filled from the later one.
    expect(plan.fields.weather).toBe('Rain')
  })

  test('chains a dive without an entry time onto the previous segment', () => {
    const keeper = {
      dive: dive({ id: 'a', entryTime: '10:00:00', durationSeconds: 1800 }),
      samples: [],
    }
    const source = {
      dive: dive({ id: 'b', durationSeconds: 600, surfaceIntervalSeconds: 300 }),
      samples: [],
    }

    const plan = planDiveMerge([keeper, source])

    expect(plan.segments[1]?.offsetSeconds).toBe(2100)
    expect(plan.segments[1]?.gapSeconds).toBe(300)
  })

  test('rejects dives whose profiles overlap', () => {
    const keeper = {
      dive: dive({ id: 'a', number: 41, entryTime: '10:00:00', durationSeconds: 3600 }),
      samples: [],
    }
    const source = {
      dive: dive({ id: 'b', number: 42, entryTime: '10:30:00', durationSeconds: 600 }),
      samples: [],
    }

    expect(() => planDiveMerge([keeper, source])).toThrow(DiveMergeError)
    expect(() => planDiveMerge([keeper, source])).toThrow(/overlaps/)
  })

  test('extends the segment when samples outlast the recorded duration', () => {
    const keeper = {
      // The computer cut out, so the samples run past the logged duration.
      dive: dive({ id: 'a', entryTime: '10:00:00', durationSeconds: 60 }),
      samples: ramp([0, 10, 20, 10], 120),
    }
    const source = {
      dive: dive({ id: 'b', durationSeconds: 600 }),
      samples: [],
    }

    const plan = planDiveMerge([keeper, source])
    expect(plan.segments[1]?.offsetSeconds).toBe(360)
  })

  test('combines aggregates across every segment', () => {
    const keeper = {
      dive: dive({
        id: 'a',
        entryTime: '10:00:00',
        durationSeconds: 600,
        maximumDepthMeters: '18.00',
        waterTemperatureCelsius: '21.00',
        maximumPpo2: '1.100000',
        suit: '5 mm',
      }),
      samples: [],
    }
    const source = {
      dive: dive({
        id: 'b',
        entryTime: '10:20:00',
        durationSeconds: 600,
        maximumDepthMeters: '31.50',
        waterTemperatureCelsius: '17.00',
        maximumPpo2: '1.400000',
        decompressionDive: true,
        weather: 'Overcast',
        suit: '7 mm',
      }),
      samples: [],
    }

    const plan = planDiveMerge([keeper, source])

    expect(plan.fields.maximumDepthMeters).toBe('31.50')
    expect(plan.fields.waterTemperatureCelsius).toBe('17.00')
    expect(plan.fields.maximumPpo2).toBe('1.400000')
    expect(plan.fields.decompressionDive).toBe(true)
    // The keeper wins where it has a value, and fills gaps from the others.
    expect(plan.fields.suit).toBe('5 mm')
    expect(plan.fields.weather).toBe('Overcast')
  })

  test('averages depth over the samples and excludes the surface gap', () => {
    const keeper = {
      dive: dive({ id: 'a', entryTime: '10:00:00', durationSeconds: 120 }),
      samples: [
        { elapsedSeconds: 0, depthMeters: '10.00' },
        { elapsedSeconds: 120, depthMeters: '10.00' },
      ],
    }
    const source = {
      dive: dive({ id: 'b', entryTime: '11:00:00', durationSeconds: 120 }),
      samples: [
        { elapsedSeconds: 0, depthMeters: '20.00' },
        { elapsedSeconds: 120, depthMeters: '20.00' },
      ],
    }

    // The hour spent at the surface between them must not pull the mean down.
    expect(planDiveMerge([keeper, source]).fields.averageDepthMeters).toBe('15.00')
  })

  test('falls back to a duration-weighted mean depth without samples', () => {
    const keeper = {
      dive: dive({
        id: 'a',
        entryTime: '10:00:00',
        durationSeconds: 1800,
        averageDepthMeters: '10.00',
      }),
      samples: [],
    }
    const source = {
      dive: dive({
        id: 'b',
        entryTime: '11:00:00',
        durationSeconds: 900,
        averageDepthMeters: '16.00',
      }),
      samples: [],
    }

    expect(planDiveMerge([keeper, source]).fields.averageDepthMeters).toBe('12.00')
  })

  test('keeps every dive’s notes, attributing the merged ones', () => {
    const keeper = {
      dive: dive({ id: 'a', entryTime: '10:00:00', notes: 'Great viz' }),
      samples: [],
    }
    const source = {
      dive: dive({
        id: 'b',
        number: 42,
        entryTime: '11:00:00',
        notes: 'Lost the group',
      }),
      samples: [],
    }

    const notes = planDiveMerge([keeper, source]).fields.notes
    expect(notes).toContain('Great viz')
    expect(notes).toContain('Lost the group')
    expect(notes).toContain('Dive #42')
  })

  test('refuses to merge a dive into itself', () => {
    const entry = { dive: dive({ id: 'a' }), samples: [] }
    expect(() => planDiveMerge([entry, entry])).toThrow(DiveMergeError)
  })
})

describe('mergeTanks', () => {
  test('continues a tank the computer kept numbering the same', () => {
    const result = mergeTanks(
      [
        tank({
          id: 'target',
          computerTankNumber: 1,
          startPressureBar: '210.00',
          endPressureBar: '120.00',
          breathingTimeSeconds: 1800,
        }),
      ],
      [
        tank({
          id: 'source',
          computerTankNumber: 1,
          startPressureBar: '120.00',
          endPressureBar: '60.00',
          breathingTimeSeconds: 900,
        }),
      ],
    )

    expect(result.appended).toEqual([])
    expect(result.combined).toEqual([
      {
        targetTankId: 'target',
        sourceTankId: 'source',
        endPressureBar: '60.00',
        breathingTimeSeconds: 2700,
      },
    ])
  })

  test('matches on name and gas when the computer numbers disagree', () => {
    const result = mergeTanks(
      [tank({ id: 'target', name: 'Left', oxygenPercent: '32.00', volumeLiters: '12' })],
      [
        tank({
          id: 'source',
          name: 'left',
          oxygenPercent: '32.00',
          volumeLiters: '12.0',
          endPressureBar: '70.00',
        }),
      ],
    )

    expect(result.combined).toHaveLength(1)
    expect(result.combined[0]?.endPressureBar).toBe('70.00')
  })

  test('appends a different gas into the next free slot', () => {
    const result = mergeTanks(
      [tank({ id: 'target', computerTankNumber: 1, oxygenPercent: '21.00' })],
      [tank({ id: 'source', computerTankNumber: 1, oxygenPercent: '50.00' })],
    )

    expect(result.combined).toEqual([])
    expect(result.appended).toEqual([
      {
        sourceTankId: 'source',
        sortOrder: 1,
        computerTankNumber: 2,
        beyondChartSlots: false,
      },
    ])
  })

  test('flags an appended tank with no pressure series left', () => {
    const result = mergeTanks(
      [
        tank({ id: 't1', computerTankNumber: 1, oxygenPercent: '21.00' }),
        tank({ id: 't2', computerTankNumber: 2, oxygenPercent: '32.00' }),
      ],
      [tank({ id: 'source', computerTankNumber: 1, oxygenPercent: '80.00' })],
    )

    expect(result.appended[0]?.computerTankNumber).toBe(3)
    expect(result.appended[0]?.beyondChartSlots).toBe(true)
  })

  test('does not let two source tanks claim the same target tank', () => {
    const result = mergeTanks(
      [tank({ id: 'target', computerTankNumber: 1, oxygenPercent: '21.00' })],
      [
        tank({ id: 's1', computerTankNumber: 1, oxygenPercent: '21.00' }),
        tank({ id: 's2', computerTankNumber: 1, oxygenPercent: '21.00' }),
      ],
    )

    expect(result.combined).toHaveLength(1)
    expect(result.appended).toHaveLength(1)
  })
})

describe('summariseProfile', () => {
  test('describes a single-segment profile', () => {
    expect(
      summariseProfile([
        { segmentIndex: 0, elapsedSeconds: 0, depthMeters: '0.00' },
        { segmentIndex: 0, elapsedSeconds: 60, depthMeters: '20.00' },
        { segmentIndex: 0, elapsedSeconds: 120, depthMeters: '20.00' },
      ]),
    ).toEqual({
      durationSeconds: 120,
      maximumDepthMeters: '20.00',
      averageDepthMeters: '15.00',
    })
  })

  test('spans every segment but excludes the surface interval from the mean', () => {
    const summary = summariseProfile([
      { segmentIndex: 0, elapsedSeconds: 0, depthMeters: '10.00' },
      { segmentIndex: 0, elapsedSeconds: 120, depthMeters: '10.00' },
      { segmentIndex: 1, elapsedSeconds: 3600, depthMeters: '20.00' },
      { segmentIndex: 1, elapsedSeconds: 3720, depthMeters: '20.00' },
    ])

    // The dive ran from the first entry to the last exit...
    expect(summary?.durationSeconds).toBe(3720)
    // ...but the hour at the surface is not depth the diver was at.
    expect(summary?.averageDepthMeters).toBe('15.00')
    expect(summary?.maximumDepthMeters).toBe('20.00')
  })

  test('has nothing to say without samples', () => {
    expect(summariseProfile([])).toBeNull()
  })
})
