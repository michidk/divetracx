import { describe, expect, test } from 'bun:test'
import { createGarminConnector } from './connector.server'

describe('Garmin connector contract', () => {
  const connector = createGarminConnector({
    async fetchFull() {
      return {
        activities: [],
        nextState: {},
        sourceDescription: 'test full feed',
      }
    },
    async fetchIncremental() {
      return {
        activities: [],
        nextState: {},
        sourceDescription: 'test incremental feed',
      }
    },
  })

  test('declares import support and explicitly omits export', () => {
    expect(connector.descriptor.capabilities).toEqual({
      fullImport: true,
      incrementalImport: true,
      export: false,
    })
    expect(connector.export).toBeUndefined()
    expect(connector.descriptor.supportedEntities).toContain('profile_samples')
  })

  test('marks a truncated full source as incomplete', async () => {
    const truncated = createGarminConnector({
      async fetchFull() {
        return {
          activities: [],
          nextState: {},
          sourceDescription: 'truncated Garmin Connect sweep',
          complete: false,
        }
      },
      async fetchIncremental() {
        throw new Error('not used')
      },
    })

    const prepared = await truncated.prepareImport({
      mode: 'full',
      state: {},
      signal: new AbortController().signal,
    })

    expect(prepared.validation.complete).toBe(false)
  })
})
