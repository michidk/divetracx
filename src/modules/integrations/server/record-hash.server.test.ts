import { describe, expect, test } from 'bun:test'
import { hashExternalRecord } from './record-hash.server'

describe('hashExternalRecord', () => {
  test('preserves version 1 hashes and changes hashes for later mapper versions', () => {
    const record = {
      entityType: 'dive_type',
      identityKey: '1',
      rawPayload: { ID: 1, Typename: 'Tieftauchgang' },
    }

    expect(hashExternalRecord(record)).toBe(
      hashExternalRecord({ ...record, mapperVersion: 1 }),
    )
    expect(hashExternalRecord({ ...record, mapperVersion: 2 })).not.toBe(
      hashExternalRecord(record),
    )
  })
})
