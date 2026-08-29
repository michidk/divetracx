import { describe, expect, test } from 'bun:test'
import {
  formatDuration,
  formatEntryTime,
  formatMeters,
  formatPersonName,
  formatTemperature,
} from './format'

describe('dive formatters', () => {
  test('formats measurements and missing values', () => {
    expect(formatMeters('31.24')).toBe('31.2 m')
    expect(formatMeters(null)).toBe('—')
    expect(formatTemperature('22.4')).toBe('22 °C')
    expect(formatTemperature(null)).toBe('—')
  })

  test('formats durations across minute and hour boundaries', () => {
    expect(formatDuration(48)).toBe('48 sec')
    expect(formatDuration(2910)).toBe('49 min')
    expect(formatDuration(7199)).toBe('2 h 0 min')
    expect(formatDuration(null)).toBe('—')
  })

  test('formats local entry time and UTC offset', () => {
    expect(formatEntryTime('14:29:00', 120)).toBe('14:29 · UTC+2')
    expect(formatEntryTime('07:05:00', -330)).toBe('07:05 · UTC−5:30')
    expect(formatEntryTime(null, null)).toBe('—')
  })

  test('joins available person names', () => {
    expect(formatPersonName({ firstName: 'Ada', lastName: 'Diver' })).toBe('Ada Diver')
    expect(formatPersonName({ firstName: null, lastName: null })).toBe('Name not set')
  })
})
