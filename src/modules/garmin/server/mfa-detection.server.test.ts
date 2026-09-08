import { describe, expect, test } from 'bun:test'
import { GarminConnect } from 'garmin-connect-2fa'

/**
 * garmin-connect-2fa is patched (see patches/) so that a successful sign-in
 * page — which mentions MFA in its embedded config — is not misread as an MFA
 * challenge. These tests fail if the patch is missing or stops applying.
 */
function httpClient() {
  const connect = new GarminConnect({ username: '', password: '' }, 'garmin.com')
  return (connect as unknown as { client: { handleMFA(html: string): void } }).client
}

const successPage = `<!DOCTYPE html><html><head><title>Success</title></head><body>
<script>window.GAUTH = {"accepts-mfa-tokens":true,"mfaEnabled":false};</script>
<a href="https://sso.garmin.com/sso/embed?ticket=ST-0123456-abcdef-cas">Continue</a>
</body></html>`

const challengePage = `<!DOCTYPE html><html><head><title>GARMIN Authentication Application</title></head><body>
<form id="login-form" action="/sso/verifyMFA/loginEnterMfaCode" method="post">
<input type="text" name="mfa-code" id="mfa-code" />
</form></body></html>`

describe('Garmin MFA detection', () => {
  test('a completed login that mentions MFA in its config is not a challenge', () => {
    expect(() => httpClient().handleMFA(successPage)).not.toThrow()
  })

  test('the code-entry form is a challenge', () => {
    expect(() => httpClient().handleMFA(challengePage)).toThrow('MFA_REQUIRED_SESSION')
  })

  test('an unrelated page is neither', () => {
    expect(() =>
      httpClient().handleMFA(
        '<html><title>Sign In</title><p>Invalid password</p></html>',
      ),
    ).not.toThrow()
  })
})
