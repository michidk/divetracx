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
})
