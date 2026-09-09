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

export interface GarminSourceGear {
  gearId: string
  type: string
  detail: Record<string, unknown>
}

export interface GarminSourceBatch {
  activities: GarminSourceActivity[]
  gear?: GarminSourceGear[]
  nextState: Record<string, unknown>
  sourceDescription: string
  /** A full import must not replace canonical data from a truncated source. */
  complete?: boolean
  diagnostics?: Record<string, unknown>
}

export interface GarminFetchOptions {
  signal?: AbortSignal
  /** Fetch the Dive app's gear and certification list alongside activities. */
  includeGear?: boolean
}

export interface GarminSourceClient {
  fetchFull(
    state: Record<string, unknown>,
    options?: GarminFetchOptions,
  ): Promise<GarminSourceBatch>
  fetchIncremental(
    state: Record<string, unknown>,
    options?: GarminFetchOptions,
  ): Promise<GarminSourceBatch>
}

export interface GarminProfileSample {
  elapsedSeconds: number
  depthMeters: number
  temperatureCelsius: number | null
  decoCeilingMeters: number | null
  heartRateBpm: number | null
  ndlSeconds: number | null
  timeToSurfaceSeconds: number | null
  cnsPercent: number | null
  nitrogenLoadPercent: number | null
}

export interface GarminGas {
  index: number
  oxygenPercent: number | null
  heliumPercent: number | null
  mode: string | null
  status: string | null
  /** From the Dive service's gas list: bottom, deco, or travel. */
  role: string | null
}

export interface GarminDiveEvent {
  elapsedSeconds: number
  kind: 'gas_switch' | 'alert' | 'marker'
  code: string
  label: string
  tankNumber: number | null
}

/** The computer that wrote the FIT file, from its `device_info` creator entry. */
export interface GarminDevice {
  product: string | null
  serialNumber: string | null
  softwareVersion: string | null
}

export interface GarminDecoSettings {
  model: string | null
  gradientFactorLow: number | null
  gradientFactorHigh: number | null
  waterType: 'fresh' | 'salt' | null
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
  averageHeartRateBpm: number | null
  maximumHeartRateBpm: number | null
  startCnsPercent: number | null
  endCnsPercent: number | null
  oxygenToxicityUnits: number | null
  deco: GarminDecoSettings | null
  decompressionDive: boolean
  device: GarminDevice | null
  events: GarminDiveEvent[]
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
