import { describe, expect, test } from 'bun:test'
import {
  DEMO_MODE_READ_ONLY_MESSAGE,
  demoModeReadOnlyResponse,
  isDemoModeWriteRequest,
} from './demo-mode.server'

describe('demo mode mutation guard', () => {
  test('allows requests when demo mode is disabled', () => {
    expect(isDemoModeWriteRequest(false, 'POST')).toBe(false)
  })

  test('allows reads and blocks writes in demo mode', () => {
    expect(isDemoModeWriteRequest(true, 'GET')).toBe(false)
    expect(isDemoModeWriteRequest(true, 'HEAD')).toBe(false)
    expect(isDemoModeWriteRequest(true, 'POST')).toBe(true)
    expect(isDemoModeWriteRequest(true, 'DELETE')).toBe(true)
  })

  test('returns a forbidden JSON response', async () => {
    const response = demoModeReadOnlyResponse()
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: DEMO_MODE_READ_ONLY_MESSAGE })
  })
})
