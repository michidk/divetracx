/**
 * Subsurface writes every quantity as "number unit" text ("30.5 m", "200.0 bar",
 * "45:30 min"). Its own reader only looks at the number and tolerates missing
 * decimals or padding, so these helpers accept the same variety.
 */

const QUANTITY = /^\s*([-+]?\d+(?:\.\d+)?)\s*([A-Za-z%°/]*)/

function quantity(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const match = QUANTITY.exec(value)
  if (!match?.[1]) return null
  const amount = Number(match[1])
  if (!Number.isFinite(amount)) return null
  return { amount, unit: (match[2] ?? '').toLowerCase() }
}

function round(value: number, decimals: number) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function parseMeters(value: string | null | undefined) {
  const parsed = quantity(value)
  if (!parsed) return null
  if (parsed.unit === 'ft') return round(parsed.amount * 0.3048, 3)
  return round(parsed.amount, 3)
}

export function parseBar(value: string | null | undefined) {
  const parsed = quantity(value)
  if (!parsed) return null
  if (parsed.unit === 'psi') return round(parsed.amount * 0.0689476, 3)
  if (parsed.unit === 'mbar') return round(parsed.amount / 1000, 3)
  return round(parsed.amount, 3)
}

export function parseCelsius(value: string | null | undefined) {
  const parsed = quantity(value)
  if (!parsed) return null
  let celsius = parsed.amount
  if (parsed.unit === 'f') celsius = (parsed.amount - 32) / 1.8
  else if (parsed.unit === 'k') celsius = parsed.amount - 273.15
  celsius = round(celsius, 2)
  // Subsurface drops implausible readings instead of storing them.
  return celsius < -40 || celsius > 70 ? null : celsius
}

export function parseLiters(value: string | null | undefined) {
  const parsed = quantity(value)
  if (!parsed) return null
  if (parsed.unit === 'cuft') return round(parsed.amount * 28.3168, 3)
  return round(parsed.amount, 3)
}

export function parseKilograms(value: string | null | undefined) {
  const parsed = quantity(value)
  if (!parsed) return null
  if (parsed.unit === 'lbs' || parsed.unit === 'lb') {
    return round(parsed.amount * 0.45359237, 3)
  }
  return round(parsed.amount, 3)
}

export function parsePercent(value: string | null | undefined) {
  const parsed = quantity(value)
  return parsed ? round(parsed.amount, 2) : null
}

/** Salinity is written as "1000 g/l" (fresh) up to roughly "1030 g/l" (sea). */
export function parseSalinity(value: string | null | undefined) {
  const parsed = quantity(value)
  return parsed ? parsed.amount : null
}

/** Durations look like "45:30 min", "1:02:15", or a bare minute count. */
export function parseDurationSeconds(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const match = /^\s*(\d+)(?::(\d+))?(?::(\d+))?/.exec(value)
  if (!match?.[1]) return null
  const numbers = [match[1], match[2], match[3]]
    .filter((part): part is string => part !== undefined)
    .map(Number)
  if (numbers.some((part) => !Number.isFinite(part))) return null
  const [first = 0, second = 0, third = 0] = numbers
  if (numbers.length === 1) return first * 60
  if (numbers.length === 2) return first * 60 + second
  return (first * 60 + second) * 60 + third
}

export function parseInteger(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const match = /^\s*([-+]?\d+)/.exec(value)
  if (!match?.[1]) return null
  const parsed = Number(match[1])
  return Number.isSafeInteger(parsed) ? parsed : null
}

/** Ratings are 0-5; Subsurface ignores anything else. */
export function parseRating(value: string | null | undefined) {
  const parsed = parseInteger(value)
  if (parsed === null || parsed < 1 || parsed > 5) return null
  return parsed
}

export function parseGps(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const match = /^\s*([-+]?\d+(?:\.\d+)?)[\s,;]+([-+]?\d+(?:\.\d+)?)/.exec(value)
  if (!match?.[1] || !match[2]) return null
  const latitude = Number(match[1])
  const longitude = Number(match[2])
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  if (latitude === 0 && longitude === 0) return null
  return { latitude: round(latitude, 7), longitude: round(longitude, 7) }
}

/** Subsurface accepts unpadded dates such as "2015-1-1". */
export function parseIsoDate(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const match = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value)
  if (!match?.[1] || !match[2] || !match[3]) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const iso = `${match[1]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const parsed = new Date(`${iso}T00:00:00Z`)
  if (parsed.getUTCFullYear() !== year || parsed.getUTCDate() !== day) return null
  return iso
}

export function parseIsoTime(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const match = /^\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/.exec(value)
  if (!match?.[1] || !match[2]) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3] ?? '0')
  if (hours > 23 || minutes > 59 || seconds > 59) return null
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

/**
 * Mirrors Subsurface's `put_milli`: up to three decimals, trailing zeros
 * removed, but always at least one decimal ("30.0 m", "13.716 m").
 */
export function formatMilli(value: number | string, unit: string) {
  const fixed = Number(value).toFixed(3).replace(/0+$/, '')
  const number = fixed.endsWith('.') ? `${fixed}0` : fixed
  return `${number} ${unit}`
}

export function formatMinutes(seconds: number) {
  const whole = Math.max(0, Math.round(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')} min`
}

export function formatPercent(value: number | string) {
  return `${Number(value).toFixed(1)}%`
}

export function formatGps(latitude: number | string, longitude: number | string) {
  return `${Number(latitude).toFixed(6)} ${Number(longitude).toFixed(6)}`
}
