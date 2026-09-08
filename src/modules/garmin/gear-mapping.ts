import type { GarminSourceGear } from './types'

/**
 * Garmin Dive's gear types mapped onto the free-text categories the gear page
 * groups by. DiveMate categories are German, so these stay English-neutral and
 * short; a user may rename them afterwards like any other imported value.
 */
const GEAR_CATEGORY_BY_TYPE: Record<string, string> = {
  BCD: 'BCD',
  BOOTS: 'Boots',
  BUOY: 'Buoy',
  CAMERA: 'Camera',
  CUTTING_TOOL: 'Cutting tool',
  DIVE_COMPUTER: 'Dive computer',
  EXPOSURE_SUIT: 'Suit',
  FIN: 'Fins',
  GLOVE: 'Gloves',
  HOOD: 'Hood',
  LIGHT: 'Light',
  MASK: 'Mask',
  REBREATHER: 'Rebreather',
  REGULATOR: 'Regulator',
  SCOOTER: 'Scooter',
  SLATE: 'Slate',
  SNORKEL: 'Snorkel',
  SPEAR: 'Spear',
  SPOOL: 'Spool',
  TANK: 'Tank',
  TRANSMITTER: 'Transmitter',
  UNDERGARMENT: 'Undergarment',
  WEIGHT: 'Weights',
  OTHER: 'Other',
}

export interface GarminMappedEquipment {
  externalId: string
  name: string
  category: string | null
  manufacturer: string | null
  model: string | null
  serialNumber: string | null
  purchasedAt: string | null
  purchasePrice: string | null
  purchaseShop: string | null
  retiredAt: string | null
  serviceDueAt: string | null
  inactive: boolean
  weightKg: string | null
  notes: string | null
}

export interface GarminMappedCertification {
  externalId: string
  name: string
  certifiedAt: string | null
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function isoDate(value: unknown) {
  const raw = text(value)
  if (!raw) return null
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw)
  return match?.[1] ?? null
}

function decimal(value: unknown, scale: number) {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN
  return Number.isFinite(parsed) ? parsed.toFixed(scale) : null
}

export function isGarminCertification(gear: GarminSourceGear) {
  return gear.type === 'CERTIFICATION'
}

export function mapGarminEquipment(gear: GarminSourceGear): GarminMappedEquipment | null {
  if (isGarminCertification(gear)) return null
  const detail = gear.detail
  const name =
    text(detail.name) ??
    [text(detail.brand), text(detail.model)].filter(Boolean).join(' ')
  if (!name) return null
  const status = text(detail.status)
  const retired = status !== null && status !== 'ACTIVE'
  const serviceNotes = [
    text(detail.lastServiceDate) ? `Last serviced ${text(detail.lastServiceDate)}` : null,
    text(detail.lastServicedBy) ? `by ${text(detail.lastServicedBy)}` : null,
  ]
    .filter(Boolean)
    .join(' ')
  const weightUnit = text(detail.surfaceWeightUnit)
  return {
    externalId: gear.gearId,
    name,
    category: GEAR_CATEGORY_BY_TYPE[gear.type] ?? GEAR_CATEGORY_BY_TYPE.OTHER ?? null,
    manufacturer: text(detail.brand),
    model: text(detail.model),
    serialNumber:
      detail.serialNumber === undefined || detail.serialNumber === null
        ? null
        : String(detail.serialNumber),
    purchasedAt: isoDate(detail.purchaseDate),
    purchasePrice: decimal(detail.purchasePrice, 2),
    purchaseShop: text(detail.purchasedFrom),
    retiredAt: retired ? isoDate(detail.lastModifiedTs) : null,
    serviceDueAt: isoDate(detail.nextServiceDate),
    inactive: retired,
    weightKg:
      weightUnit === null || weightUnit === 'KILOGRAM'
        ? decimal(detail.surfaceWeight, 3)
        : weightUnit === 'POUND'
          ? decimal(Number(detail.surfaceWeight) * 0.45359237, 3)
          : null,
    notes: serviceNotes || null,
  }
}

export function mapGarminCertification(
  gear: GarminSourceGear,
): GarminMappedCertification | null {
  if (!isGarminCertification(gear)) return null
  const name = text(gear.detail.name)
  if (!name) return null
  return {
    externalId: gear.gearId,
    name,
    certifiedAt: isoDate(gear.detail.dateOfFirstUse),
  }
}

/** Case- and whitespace-insensitive key for matching imported names to existing rows. */
export function normalizedGearName(value: string) {
  return value.trim().replaceAll(/\s+/g, ' ').toLocaleLowerCase('en-US')
}
