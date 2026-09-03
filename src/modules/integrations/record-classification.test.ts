import { describe, expect, test } from 'bun:test'
import {
  classifyExternalRecords,
  validateExternalRecordInputs,
} from './record-classification'

describe('external record classification', () => {
  test('classifies new, changed, and unchanged source records', () => {
    const classified = classifyExternalRecords(
      [
        { id: 'existing-1', entityType: 'dive', identityKey: '1', contentHash: 'a' },
        { id: 'existing-2', entityType: 'dive', identityKey: '2', contentHash: 'b' },
      ],
      [
        {
          entityType: 'dive',
          identityKey: '1',
          rawPayload: { id: 1 },
          contentHash: 'a',
        },
        {
          entityType: 'dive',
          identityKey: '2',
          rawPayload: { id: 2, changed: true },
          contentHash: 'changed',
        },
        {
          entityType: 'dive',
          identityKey: '3',
          rawPayload: { id: 3 },
          contentHash: 'c',
        },
      ],
    )

    expect(classified.map(({ change }) => change)).toEqual([
      'unchanged',
      'updated',
      'created',
    ])
    expect(classified.map(({ existingId }) => existingId)).toEqual([
      'existing-1',
      'existing-2',
      null,
    ])
  })

  test('rejects ambiguous duplicate identities before importing', () => {
    expect(() =>
      validateExternalRecordInputs([
        { entityType: 'dive', identityKey: '42', rawPayload: {} },
        { entityType: 'dive', identityKey: '42', rawPayload: { duplicate: true } },
      ]),
    ).toThrow('Duplicate external record identity dive:42')
  })
})
