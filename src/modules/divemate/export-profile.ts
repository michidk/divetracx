export interface CanonicalProfileSample {
  elapsedSeconds: number
  depthMeters: string
  temperatureCelsius: string | null
  pressureBar: string | null
  tank1PressureBar: string | null
  tank2PressureBar: string | null
  decoCeilingMeters: string | null
  tankNumber: number | null
}

export interface DiveMateEncodedProfile {
  profileIntervalSeconds: number | null
  profile: string | null
  profile2: string | null
  profile3: string | null
  profile4: string | null
}

function integer(value: string | null, multiplier: number, maximum: number) {
  if (value === null) return 0
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(maximum, Math.max(0, Math.round(parsed * multiplier)))
}

function fixed(value: number, width: number) {
  return String(value).padStart(width, '0').slice(-width)
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left)
  let b = Math.abs(right)
  while (b > 0) [a, b] = [b, a % b]
  return a
}

function profileInterval(samples: CanonicalProfileSample[]) {
  const elapsed = [...new Set(samples.map((sample) => sample.elapsedSeconds))].sort(
    (left, right) => left - right,
  )
  const differences = elapsed
    .slice(1)
    .map((value, index) => value - (elapsed[index] ?? value))
    .filter((value) => value > 0)
  if (differences.length === 0) return null
  return differences.reduce(greatestCommonDivisor)
}

function regularSamples(
  samples: CanonicalProfileSample[],
  interval: number,
): CanonicalProfileSample[] {
  const sorted = [...samples].sort(
    (left, right) => left.elapsedSeconds - right.elapsedSeconds,
  )
  const lastElapsed = sorted.at(-1)?.elapsedSeconds ?? 0
  let sourceIndex = 0
  const result: CanonicalProfileSample[] = []
  for (let elapsed = 0; elapsed <= lastElapsed; elapsed += interval) {
    while (
      sourceIndex + 1 < sorted.length &&
      (sorted[sourceIndex + 1]?.elapsedSeconds ?? Number.POSITIVE_INFINITY) <= elapsed
    ) {
      sourceIndex += 1
    }
    const source = sorted[sourceIndex]
    if (source) result.push({ ...source, elapsedSeconds: elapsed })
  }
  return result
}

export function encodeDiveMateProfile(
  samples: CanonicalProfileSample[],
): DiveMateEncodedProfile {
  const interval = profileInterval(samples)
  if (!interval) {
    return {
      profileIntervalSeconds: null,
      profile: null,
      profile2: null,
      profile3: null,
      profile4: null,
    }
  }
  const regular = regularSamples(samples, interval)
  return {
    profileIntervalSeconds: interval,
    profile: regular
      .map((sample) => `${fixed(integer(sample.depthMeters, 10, 9_999), 4)}00000000`)
      .join(''),
    profile2: regular
      .map((sample) => {
        const temperature = fixed(integer(sample.temperatureCelsius, 10, 999), 3)
        const pressure = fixed(integer(sample.pressureBar, 10, 9_999), 4)
        const tank = Math.min(9, Math.max(0, (sample.tankNumber ?? 1) - 1))
        return `${temperature}${pressure}${tank}000`
      })
      .join(''),
    profile3: regular
      .map(
        (sample) =>
          `${fixed(integer(sample.tank1PressureBar, 10, 9_999), 4)}${fixed(
            integer(sample.tank2PressureBar, 10, 9_999),
            4,
          )}000000`,
      )
      .join(''),
    profile4: regular
      .map((sample) => `000000${fixed(integer(sample.decoCeilingMeters, 1, 999), 3)}`)
      .join(''),
  }
}
