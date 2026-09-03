import { describe, expect, test } from 'bun:test'
import { formatDiveMateDiveTeam, parseDiveMateDiveTeam } from './dive-team'

describe('DiveMate dive team roles', () => {
  test('imports an existing unlabelled divemaster value', () => {
    expect(parseDiveMateDiveTeam('Alex Morgan')).toEqual([
      { name: 'Alex Morgan', role: 'divemaster' },
    ])
  })

  test('round-trips explicit staff roles through the free-text field', () => {
    const encoded = formatDiveMateDiveTeam([
      { name: 'Alex Morgan', role: 'guide' },
      { name: 'Sam Rivera', role: 'instructor' },
    ])

    expect(encoded).toBe('Guide: Alex Morgan; Instructor: Sam Rivera')
    expect(parseDiveMateDiveTeam(encoded)).toEqual([
      { name: 'Alex Morgan', role: 'guide' },
      { name: 'Sam Rivera', role: 'instructor' },
    ])
  })
})
