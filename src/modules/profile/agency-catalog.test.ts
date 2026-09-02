import { describe, expect, test } from 'bun:test'
import { agencyCatalog, agencySelectionForName, findAgencyByName } from './agency-catalog'

describe('dive agency catalog', () => {
  test('includes every referenced agency with distinct SDI and TDI entries', () => {
    expect(agencyCatalog.map((agency) => agency.code)).toEqual([
      'padi',
      'ssi',
      'naui',
      'cmas',
      'bsac',
      'fipsas',
      'sdi',
      'tdi',
      'iantd',
    ])
    expect(new Set(agencyCatalog.map((agency) => agency.logoSrc)).size).toBe(
      agencyCatalog.length,
    )
  })

  test('recognizes agency acronyms and full names', () => {
    expect(findAgencyByName('TDI')?.code).toBe('tdi')
    expect(findAgencyByName('Scuba Diving International')?.code).toBe('sdi')
    expect(
      findAgencyByName('Federazione Italiana Pesca Sportiva e Attivita Subacquee')?.code,
    ).toBe('fipsas')
  })

  test('preserves unknown organizations as custom agencies', () => {
    expect(agencySelectionForName('Local Diving Association')).toEqual({
      agencyCode: 'custom',
      customAgencyName: 'Local Diving Association',
    })
    expect(agencySelectionForName(' PADI ')).toEqual({
      agencyCode: 'padi',
      customAgencyName: null,
    })
  })
})
