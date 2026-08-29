export interface DiveMateSourceRecord {
  externalId: string
  externalUuid: string | null
  sourceUpdatedAt: string | null
  sourcePayload: Record<string, unknown>
}

export interface DiveMateDiver extends DiveMateSourceRecord {
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  birthDate: string | null
  bloodGroup: string | null
  emergencyContact: string | null
  emergencyPhone: string | null
  insurance: string | null
  notes: string | null
}

export interface DiveMateSite extends DiveMateSourceRecord {
  name: string
  country: string | null
  region: string | null
  waterName: string | null
  latitude: string | null
  longitude: string | null
  sourceLatitude: string | null
  sourceLongitude: string | null
  maximumDepthMeters: string | null
  altitudeMeters: number | null
  difficulty: string | null
  rating: number | null
  waterType: number | null
  notes: string | null
}

export interface DiveMateBuddy extends DiveMateSourceRecord {
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  city: string | null
  country: string | null
  notes: string | null
}

export interface DiveMateEquipment extends DiveMateSourceRecord {
  name: string
  category: string | null
  manufacturer: string | null
  model: string | null
  serialNumber: string | null
  purchasedAt: string | null
  retiredAt: string | null
  serviceDueAt: string | null
  inactive: boolean
  weightKg: string | null
  notes: string | null
}

export interface DiveMateCertification extends DiveMateSourceRecord {
  diverExternalId: string | null
  name: string
  organization: string | null
  certificationNumber: string | null
  certifiedAt: string | null
  instructorName: string | null
  instructorNumber: string | null
}

export interface DiveMateShop extends DiveMateSourceRecord {
  name: string
}

export interface DiveMateDiveType extends DiveMateSourceRecord {
  name: string
  sortOrder: number | null
}

export interface DiveMateDive extends DiveMateSourceRecord {
  diverExternalId: string | null
  siteExternalId: string | null
  shopExternalId: string | null
  diveTypeExternalId: string | null
  buddyExternalIds: string[]
  equipmentExternalIds: string[]
  number: number | null
  diveDate: string
  entryTime: string | null
  utcOffsetMinutes: number | null
  durationSeconds: number
  surfaceIntervalSeconds: number | null
  maximumDepthMeters: string | null
  averageDepthMeters: string | null
  airTemperatureCelsius: string | null
  waterTemperatureCelsius: string | null
  weightKg: string | null
  visibility: string | null
  current: string | null
  waves: string | null
  weather: string | null
  waterType: number | null
  entryType: number | null
  rating: number | null
  computer: string | null
  suit: string | null
  boat: string | null
  divemaster: string | null
  notes: string | null
}

export interface DiveMateTank extends DiveMateSourceRecord {
  diveExternalId: string
  name: string | null
  sortOrder: number | null
  tankType: number | null
  volumeLiters: string | null
  startPressureBar: string | null
  endPressureBar: string | null
  oxygenPercent: string | null
  heliumPercent: string | null
  breathingTimeSeconds: number | null
}

export interface DiveMateProfileSample extends DiveMateSourceRecord {
  diveExternalId: string
  sampleIndex: number
  elapsedSeconds: number
  depthMeters: string
}

export interface DiveMateSnapshot {
  databaseVersion: string | null
  divers: DiveMateDiver[]
  sites: DiveMateSite[]
  buddies: DiveMateBuddy[]
  equipment: DiveMateEquipment[]
  certifications: DiveMateCertification[]
  shops: DiveMateShop[]
  diveTypes: DiveMateDiveType[]
  dives: DiveMateDive[]
  tanks: DiveMateTank[]
  profileSamples: DiveMateProfileSample[]
}
