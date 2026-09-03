import { describe, expect, test } from 'bun:test'
import {
  cleanDiveMateInstructorName,
  formatDiveMateInstructor,
  normalizeDiveMateInstructorName,
} from './instructor'

describe('DiveMate instructor names', () => {
  test('formats a buddy as the text expected by DiveMate', () => {
    expect(formatDiveMateInstructor({ firstName: ' Ada ', lastName: '  Diver ' })).toBe(
      'Ada Diver',
    )
    expect(formatDiveMateInstructor({ firstName: null, lastName: null })).toBeNull()
  })

  test('normalizes imported names for buddy matching', () => {
    expect(cleanDiveMateInstructorName('  Ada   Diver  ')).toBe('Ada Diver')
    expect(normalizeDiveMateInstructorName('  ADA   Diver  ')).toBe('ada diver')
    expect(normalizeDiveMateInstructorName('  ')).toBeNull()
  })
})
