/** Server-rendered setup page for the Garmin adapter, in the spirit of
 * liftosaur2garmin's web dashboard: connection status, a Garmin Connect login
 * form, and a disconnect action. Pure so it can be tested without a server. */

export interface GarminAdapterPageProps {
  connected: boolean
  tokensSavedAt: Date | null
  message?: string | null
  error?: string | null
}

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const PAGE_STYLE = `
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 0; display: grid;
    place-items: center; min-height: 100vh; background: #0b1220; color: #e5edf5; }
  main { width: min(26rem, calc(100vw - 2rem)); background: #131c2e;
    border: 1px solid #24324a; border-radius: 12px; padding: 1.5rem; }
  h1 { font-size: 1.15rem; margin: 0 0 0.25rem; }
  p { margin: 0.5rem 0; line-height: 1.45; font-size: 0.9rem; color: #aebdd0; }
  .status { display: inline-block; border-radius: 999px; padding: 0.15rem 0.6rem;
    font-size: 0.8rem; margin: 0.5rem 0; }
  .status.connected { background: #103824; color: #6ee7a8; }
  .status.disconnected { background: #3a1a1a; color: #f3a0a0; }
  .banner { border-radius: 8px; padding: 0.6rem 0.8rem; font-size: 0.85rem;
    margin: 0.75rem 0; }
  .banner.message { background: #103824; color: #a7f3c9; }
  .banner.error { background: #3a1a1a; color: #fecaca; }
  form { display: grid; gap: 0.6rem; margin-top: 1rem; }
  label { font-size: 0.8rem; color: #aebdd0; display: grid; gap: 0.25rem; }
  input { background: #0b1220; color: inherit; border: 1px solid #2c3b57;
    border-radius: 8px; padding: 0.5rem 0.65rem; font-size: 0.9rem; }
  button { border: 0; border-radius: 8px; padding: 0.55rem 0.8rem;
    font-size: 0.9rem; cursor: pointer; }
  .primary { background: #2563eb; color: white; }
  .secondary { background: #24324a; color: #e5edf5; margin-top: 0.75rem; }
`

export function renderGarminAdapterPage(props: GarminAdapterPageProps) {
  const statusBadge = props.connected
    ? `<span class="status connected">Connected to Garmin Connect</span>`
    : `<span class="status disconnected">Not connected</span>`
  const savedAt =
    props.connected && props.tokensSavedAt
      ? `<p>Tokens saved ${escapeHtml(props.tokensSavedAt.toISOString())}. They are refreshed automatically on use.</p>`
      : ''
  const banner = props.error
    ? `<div class="banner error">${escapeHtml(props.error)}</div>`
    : props.message
      ? `<div class="banner message">${escapeHtml(props.message)}</div>`
      : ''
  const disconnect = props.connected
    ? `<form method="post" action="/logout">
        <button class="secondary" type="submit">Disconnect and delete tokens</button>
      </form>`
    : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Divetracx Garmin adapter</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<main>
  <h1>Divetracx Garmin adapter</h1>
  <p>Signs in to Garmin Connect and serves dive activities to Divetracx.</p>
  ${statusBadge}
  ${savedAt}
  ${banner}
  <form method="post" action="/login">
    <label>Garmin Connect email
      <input type="email" name="email" autocomplete="username" required>
    </label>
    <label>Password
      <input type="password" name="password" autocomplete="current-password" required>
    </label>
    <button class="primary" type="submit">${props.connected ? 'Log in again' : 'Log in to Garmin Connect'}</button>
  </form>
  <p>Credentials are sent to Garmin once to obtain tokens and are never stored.
  Accounts with multi-factor authentication are not supported yet.</p>
  ${disconnect}
</main>
</body>
</html>`
}
