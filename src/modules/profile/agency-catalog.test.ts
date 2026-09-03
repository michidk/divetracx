import { describe, expect, test } from 'bun:test'
import { agencyCatalog, findAgencyByName, normalizedAgencyName } from './agency-catalog'

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
    expect(agencyCatalog.every((agency) => agency.websiteUrl && agency.loginUrl)).toBe(
      true,
    )
    expect(
      agencyCatalog
        .filter((agency) => ['bsac', 'sdi', 'tdi'].includes(agency.code))
        .map((agency) => agency.logoSrc),
    ).toEqual([
      '/agency-logos/bsac.svg',
      '/agency-logos/sdi.svg',
      '/agency-logos/tdi.svg',
    ])
  })

  test('recognizes agency acronyms and full names', () => {
    expect(findAgencyByName('TDI')?.code).toBe('tdi')
    expect(findAgencyByName('Scuba Diving International')?.code).toBe('sdi')
    expect(
      findAgencyByName('Federazione Italiana Pesca Sportiva e Attività Subacquee')?.code,
    ).toBe('fipsas')
  })

  test('normalizes names case-insensitively after trimming', () => {
    expect(normalizedAgencyName(' Local Diving Association ')).toBe(
      'local diving association',
    )
    expect(findAgencyByName(' PADI ')?.code).toBe('padi')
  })
})
