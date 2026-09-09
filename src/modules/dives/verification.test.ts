import { describe, expect, test } from 'bun:test'
import { findDuplicateDiveCandidates, type VerificationDive } from './verification'

function dive(overrides: Partial<VerificationDive> & { id: string }): VerificationDive {
  return {
    number: null,
    diveDate: '2026-06-14',
    entryTime: '10:00:00',
    durationSeconds: 2_400,
    maximumDepthMeters: '20.0',
    siteId: 'site-one',
    siteName: 'Blue Hole',
    captureSource: 'manual',
    ...overrides,
  }
}

describe('findDuplicateDiveCandidates', () => {
  test('flags entries with nearly identical start times as likely duplicates', () => {
    const result = findDuplicateDiveCandidates([
      dive({ id: 'one' }),
      dive({ id: 'two', entryTime: '10:01:30', captureSource: 'garmin' }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]?.confidence).toBe('likely')
    expect(result[0]?.reasons).toContain('start times within 2 minutes')
  })

  test('requires corroborating details for less precise start times', () => {
    const result = findDuplicateDiveCandidates([
      dive({ id: 'one', entryTime: '10:00:00' }),
      dive({
        id: 'two',
        entryTime: '10:30:00',
        siteId: 'elsewhere',
        durationSeconds: 5_000,
        maximumDepthMeters: '40.0',
      }),
    ])

    expect(result).toEqual([])
  })

  test('flags matching untimed records only when several details agree', () => {
    const result = findDuplicateDiveCandidates([
      dive({ id: 'one', entryTime: null }),
      dive({ id: 'two', entryTime: null, durationSeconds: 2_550 }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]?.confidence).toBe('possible')
    expect(result[0]?.reasons).toContain('one or both start times missing')
  })

  test('never compares dives logged on different dates', () => {
    const result = findDuplicateDiveCandidates([
      dive({ id: 'one' }),
      dive({ id: 'two', diveDate: '2026-06-15' }),
    ])

    expect(result).toEqual([])
  })
})
