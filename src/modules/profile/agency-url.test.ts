import { describe, expect, test } from 'bun:test'
import { normalizeAgencyUrl } from './agency-url'

describe('agency URL normalization', () => {
  test('normalizes optional HTTP URLs', () => {
    expect(normalizeAgencyUrl(' https://example.com/member ', 'Login URL')).toBe(
      'https://example.com/member',
    )
    expect(normalizeAgencyUrl('', 'Website URL')).toBeNull()
    expect(normalizeAgencyUrl(undefined, 'Website URL')).toBeNull()
  })

  test('rejects invalid or unsafe protocols', () => {
    expect(() => normalizeAgencyUrl('not a URL', 'Website URL')).toThrow(
      'Website URL must be a valid URL',
    )
    expect(() => normalizeAgencyUrl('javascript:alert(1)', 'Login URL')).toThrow(
      'Login URL must use http or https',
    )
  })
})
