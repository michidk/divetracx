export interface GarminActivitySummary {
  activityId: string
  activityType: string | null
  activityName: string | null
  deviceName: string | null
  startTimeInSeconds: number | null
  startTimeOffsetInSeconds: number | null
  durationInSeconds: number | null
  startingLatitudeInDegree: number | null
  startingLongitudeInDegree: number | null
  maximumDepthInMeters: number | null
  averageDepthInMeters: number | null
}

export interface GarminActivityDetails {
  activityId: string
  summaryId: string | null
  insertedDate: string | null
  summary: GarminActivitySummary
  raw: Record<string, unknown>
}

export interface GarminSourceActivity {
  activityDetails: Record<string, unknown>
  fitBytes?: Uint8Array
  fitFileName?: string | null
  fitContentType?: string | null
}

export interface GarminSourceBatch {
  activities: GarminSourceActivity[]
  nextState: Record<string, unknown>
  sourceDescription: string
  /** A full import must not replace canonical data from a truncated source. */
  complete?: boolean
  diagnostics?: Record<string, unknown>
}

export interface GarminSourceClient {
  fetchFull(
    state: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<GarminSourceBatch>
  fetchIncremental(
    state: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<GarminSourceBatch>
}

export interface GarminProfileSample {
  elapsedSeconds: number
  depthMeters: number
  temperatureCelsius: number | null
  decoCeilingMeters: number | null
}

export interface GarminGas {
  index: number
  oxygenPercent: number | null
  heliumPercent: number | null
  mode: string | null
  status: string | null
}

export interface GarminMappedDive {
  externalId: string
  startEpochSeconds: number
  diveDate: string
  entryTime: string | null
  utcOffsetMinutes: number | null
  durationSeconds: number
  surfaceIntervalSeconds: number | null
  maximumDepthMeters: number | null
  averageDepthMeters: number | null
  waterTemperatureCelsius: number | null
  maximumPpo2: number | null
  number: number | null
  computer: string | null
  notes: string | null
  activityName: string | null
  latitude: number | null
  longitude: number | null
  profileSamples: GarminProfileSample[]
  gases: GarminGas[]
  fitProfileVersion: string | null
}
