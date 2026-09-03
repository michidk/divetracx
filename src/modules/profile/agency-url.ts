const MAX_AGENCY_URL_LENGTH = 2_048

export function normalizeAgencyUrl(value: string | undefined, label: string) {
  const trimmedValue = value?.trim()
  if (!trimmedValue) return null
  if (trimmedValue.length > MAX_AGENCY_URL_LENGTH) {
    throw new Error(`${label} is too long`)
  }

  let url: URL
  try {
    url = new URL(trimmedValue)
  } catch {
    throw new Error(`${label} must be a valid URL`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${label} must use http or https`)
  }

  return url.toString()
}
