import type { DiveBuddyRole } from '@/modules/dives/buddy-role'

export interface SubsurfaceSite {
  externalId: string
  name: string
  latitude: number | null
  longitude: number | null
  country: string | null
  region: string | null
  waterName: string | null
  notes: string | null
}

export interface SubsurfaceCylinder {
  sortOrder: number
  description: string | null
  volumeLiters: number | null
  workingPressureBar: number | null
  startPressureBar: number | null
  endPressureBar: number | null
  oxygenPercent: number | null
  heliumPercent: number | null
}

export interface SubsurfaceSample {
  elapsedSeconds: number
  depthMeters: number
  temperatureCelsius: number | null
  /** Pressure of the cylinder in use at this sample. */
  pressureBar: number | null
  tank1PressureBar: number | null
  tank2PressureBar: number | null
  decoCeilingMeters: number | null
  /** One-based cylinder in use; only set for dives with gas changes. */
  tankNumber: number | null
}

export interface SubsurfacePerson {
  name: string
  role: DiveBuddyRole
}

export interface SubsurfaceDive {
  externalId: string
  number: number | null
  diveDate: string
  entryTime: string | null
  durationSeconds: number
  maximumDepthMeters: number | null
  averageDepthMeters: number | null
  airTemperatureCelsius: number | null
  waterTemperatureCelsius: number | null
  weightKg: number | null
  rating: number | null
  /** Subsurface rates visibility 1-5. */
  visibility: number | null
  waterType: number | null
  entryType: number | null
  tags: string[]
  suit: string | null
  computer: string | null
  notes: string | null
  decompressionDive: boolean
  siteExternalId: string | null
  people: SubsurfacePerson[]
  cylinders: SubsurfaceCylinder[]
  samples: SubsurfaceSample[]
}

export interface SubsurfaceLogbook {
  /** Value of the `version` attribute, or 1 for the original `<dives>` layout. */
  formatVersion: number
  sites: SubsurfaceSite[]
  dives: SubsurfaceDive[]
  diagnostics: {
    divesSkipped: number
    tripsSeen: number
  }
}
