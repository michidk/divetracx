export interface VerificationDive {
  id: string
  number: number | null
  diveDate: string
  entryTime: string | null
  durationSeconds: number
  maximumDepthMeters: string | null
  siteId: string | null
  siteName: string | null
  captureSource: string
}

export interface DuplicateDiveCandidate {
  confidence: 'likely' | 'possible'
  reasons: string[]
  dives: [VerificationDive, VerificationDive]
}

function clockSeconds(value: string | null) {
  if (!value) return null
  const parts = value.split(':').map(Number)
  if (parts.length !== 3 || !parts.every(Number.isFinite)) return null
  const [hours = 0, minutes = 0, seconds = 0] = parts
  return hours * 3_600 + minutes * 60 + seconds
}

function matchingDetails(left: VerificationDive, right: VerificationDive) {
  const details: string[] = []
  if (left.siteId !== null && left.siteId === right.siteId) {
    details.push('same dive site')
  }
  if (
    left.durationSeconds > 0 &&
    right.durationSeconds > 0 &&
    Math.abs(left.durationSeconds - right.durationSeconds) <= 5 * 60
  ) {
    details.push('durations within 5 minutes')
  }
  if (
    left.maximumDepthMeters !== null &&
    right.maximumDepthMeters !== null &&
    Math.abs(Number(left.maximumDepthMeters) - Number(right.maximumDepthMeters)) <= 3
  ) {
    details.push('maximum depths within 3 metres')
  }
  return details
}

/**
 * Finds records that may describe the same real-world dive. A close start time
 * is the strongest signal; entries without times need several matching dive
 * details so ordinary same-day repetitive dives are not flagged casually.
 */
export function findDuplicateDiveCandidates(dives: VerificationDive[]) {
  const byDate = new Map<string, VerificationDive[]>()
  for (const dive of dives) {
    const sameDay = byDate.get(dive.diveDate) ?? []
    sameDay.push(dive)
    byDate.set(dive.diveDate, sameDay)
  }

  const candidates: DuplicateDiveCandidate[] = []
  for (const sameDay of byDate.values()) {
    for (let leftIndex = 0; leftIndex < sameDay.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < sameDay.length; rightIndex += 1) {
        const left = sameDay[leftIndex]
        const right = sameDay[rightIndex]
        if (!left || !right) continue

        const leftStart = clockSeconds(left.entryTime)
        const rightStart = clockSeconds(right.entryTime)
        const details = matchingDetails(left, right)
        const sameNumber = left.number !== null && left.number === right.number

        if (leftStart !== null && rightStart !== null) {
          const differenceSeconds = Math.abs(leftStart - rightStart)
          if (differenceSeconds <= 2 * 60) {
            candidates.push({
              confidence: 'likely',
              reasons: ['start times within 2 minutes', ...details],
              dives: [left, right],
            })
          } else if (differenceSeconds <= 10 * 60 && details.length >= 1) {
            candidates.push({
              confidence: 'likely',
              reasons: ['start times within 10 minutes', ...details],
              dives: [left, right],
            })
          } else if (differenceSeconds <= 45 * 60 && details.length >= 2) {
            candidates.push({
              confidence: 'possible',
              reasons: ['start times within 45 minutes', ...details],
              dives: [left, right],
            })
          }
          continue
        }

        if (details.length === 3 || (sameNumber && details.length >= 2)) {
          candidates.push({
            confidence: 'possible',
            reasons: [
              ...(sameNumber ? ['same dive number'] : []),
              ...details,
              'one or both start times missing',
            ],
            dives: [left, right],
          })
        }
      }
    }
  }

  return candidates.sort((left, right) => {
    if (left.confidence !== right.confidence) return left.confidence === 'likely' ? -1 : 1
    return right.dives[0].diveDate.localeCompare(left.dives[0].diveDate)
  })
}
