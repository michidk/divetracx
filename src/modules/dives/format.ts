export function formatDiveDate(value: string, dateStyle: 'medium' | 'long' = 'long') {
  return new Intl.DateTimeFormat('en-US', { dateStyle }).format(
    new Date(`${value}T00:00:00`),
  )
}

export function formatDuration(seconds: number | null) {
  if (seconds === null) return '—'
  if (seconds < 60) return `${seconds} sec`

  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`
}

export function formatMeters(value: string | null) {
  return value === null ? '—' : `${Number(value).toFixed(1)} m`
}

export function formatTemperature(value: string | null) {
  return value === null ? '—' : `${Number(value).toFixed(0)} °C`
}

export function formatEntryTime(time: string | null, offsetMinutes: number | null) {
  if (!time) return '—'
  const clock = time.slice(0, 5)
  if (offsetMinutes === null) return clock

  const sign = offsetMinutes < 0 ? '−' : '+'
  const absoluteMinutes = Math.abs(offsetMinutes)
  const hours = Math.floor(absoluteMinutes / 60)
  const minutes = absoluteMinutes % 60
  const offset = minutes > 0 ? `${hours}:${String(minutes).padStart(2, '0')}` : hours
  return `${clock} · UTC${sign}${offset}`
}

export function formatPersonName(person: {
  firstName: string | null
  lastName: string | null
}) {
  return [person.firstName, person.lastName].filter(Boolean).join(' ') || 'Name not set'
}
