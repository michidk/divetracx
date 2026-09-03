import { describe, expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'
import { hasValidOwnerSession } from './auth.server'

describe('Hodor owner session verification', () => {
  test('accepts only an unexpired cookie with a valid HMAC', () => {
    const secret = 's'.repeat(64)
    const expiry = '2000'
    const signature = createHmac('sha256', secret).update(expiry).digest('hex')
    const valid = new Request('https://example.test', {
      headers: { Cookie: `other=x; hodor=${expiry}|${signature}` },
    })
    expect(hasValidOwnerSession(valid, secret, 1000)).toBe(true)
    expect(hasValidOwnerSession(valid, secret, 3000)).toBe(false)
    expect(
      hasValidOwnerSession(
        new Request('https://example.test', {
          headers: { Cookie: `hodor=${expiry}|${'0'.repeat(64)}` },
        }),
        secret,
        1000,
      ),
    ).toBe(false)
  })
})
