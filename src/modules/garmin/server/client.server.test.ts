import { describe, expect, test } from 'bun:test'
import { createGarminSourceClient } from './client.server'

describe('Garmin main-app transport', () => {
  test('passes opaque state to the in-process Garmin Connect source', async () => {
    const calls: Array<{ mode: string; state: Record<string, unknown> }> = []
    const client = createGarminSourceClient({
      async fetchBatch(mode, state) {
        calls.push({ mode, state })
        return {
          activities: [],
          nextState: { lastActivityStartSeconds: 1_786_951_930 },
          sourceDescription: 'Garmin Connect incremental activity sweep',
          complete: true,
          diagnostics: {},
        }
      },
    })

    const result = await client.fetchIncremental({ lastActivityStartSeconds: 123 })

    expect(calls).toEqual([
      { mode: 'incremental', state: { lastActivityStartSeconds: 123 } },
    ])
    expect(result.nextState).toEqual({ lastActivityStartSeconds: 1_786_951_930 })
  })

  test('honors a cancelled import before contacting Garmin', async () => {
    const controller = new AbortController()
    controller.abort(new Error('cancelled'))
    const client = createGarminSourceClient({
      async fetchBatch() {
        throw new Error('should not run')
      },
    })

    expect(() => client.fetchFull({}, controller.signal)).toThrow('cancelled')
  })
})
