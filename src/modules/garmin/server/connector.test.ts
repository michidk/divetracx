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
    expect(connector.descriptor.entities.map((entity) => entity.key)).toContain(
      'profile_samples',
    )
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
      isEntityEnabled: () => true,
    })

    expect(prepared.validation.complete).toBe(false)
  })
})

describe('Garmin gear and certification records', () => {
  const gear = [
    {
      gearId: '141548',
      type: 'REGULATOR',
      detail: {
        name: 'Atomic B2',
        type: 'REGULATOR',
        lastModifiedTs: '2025-01-02T00:00:00Z',
      },
    },
    {
      gearId: '463947',
      type: 'CERTIFICATION',
      detail: { name: 'Deep Diver', type: 'CERTIFICATION', dateOfFirstUse: '2025-01-01' },
    },
  ]

  function connectorWith(seen: Array<boolean | undefined>) {
    return createGarminConnector({
      async fetchFull(_state, options) {
        seen.push(options?.includeGear)
        return {
          activities: [],
          gear: options?.includeGear ? gear : undefined,
          nextState: {},
          sourceDescription: 'test full feed',
        }
      },
      async fetchIncremental() {
        throw new Error('not used')
      },
    })
  }

  test('asks the source for gear only when gear or certifications are switched on', async () => {
    const seen: Array<boolean | undefined> = []
    const connector = connectorWith(seen)

    const withGear = await connector.prepareImport({
      mode: 'full',
      state: {},
      signal: new AbortController().signal,
      isEntityEnabled: (key) => key !== 'certifications',
    })
    expect(
      withGear.records.map((record) => `${record.entityType}:${record.identityKey}`),
    ).toEqual(['gear:141548', 'certification:463947'])
    expect(withGear.diagnostics).toMatchObject({ gearReceived: 2 })

    const withoutGear = await connector.prepareImport({
      mode: 'full',
      state: {},
      signal: new AbortController().signal,
      isEntityEnabled: (key) => key !== 'equipment' && key !== 'certifications',
    })
    expect(withoutGear.records).toEqual([])
    expect(seen).toEqual([true, false])
  })

  test('declares gear and certifications as independent, switchable entities', () => {
    const connector = connectorWith([])
    const byKey = new Map(
      connector.descriptor.entities.map((entity) => [entity.key, entity]),
    )
    expect(byKey.get('equipment')).toMatchObject({ recordTypes: ['gear'] })
    expect(byKey.get('equipment')?.dependsOn).toBeUndefined()
    expect(byKey.get('certifications')).toMatchObject({ recordTypes: ['certification'] })
    expect(byKey.get('dives')?.required).toBe(true)
  })
})
