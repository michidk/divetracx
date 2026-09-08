import { describe, expect, test } from 'bun:test'
import {
  isGarminCertification,
  mapGarminCertification,
  mapGarminEquipment,
  normalizedGearName,
} from './gear-mapping'

const regulator = {
  gearId: '141548',
  type: 'REGULATOR',
  detail: {
    gearId: 141548,
    name: 'Atomic B2 Regulator',
    type: 'REGULATOR',
    brand: 'Atomic Aquatics',
    model: 'B2',
    serialNumber: 'TEST-REG-1',
    lastServiceDate: '2025-01-01',
    serviceIntervalDays: 730,
    lastServicedBy: 'Test Dive Shop',
    nextServiceDate: '2027-01-01',
    dateOfFirstUse: '2023-01-01',
    purchasePrice: 872.4,
    purchaseCurrency: 'GBP',
    purchasedFrom: 'Test Dive Shop',
    purchaseDate: '2022-12-01',
    surfaceWeight: 1.1,
    surfaceWeightUnit: 'KILOGRAM',
    status: 'ACTIVE',
    lastModifiedTs: '2025-01-02T00:00:00Z',
  },
}

describe('Garmin gear mapping', () => {
  test('maps a gear item onto canonical equipment', () => {
    expect(mapGarminEquipment(regulator)).toEqual({
      externalId: '141548',
      name: 'Atomic B2 Regulator',
      category: 'Regulator',
      manufacturer: 'Atomic Aquatics',
      model: 'B2',
      serialNumber: 'TEST-REG-1',
      purchasedAt: '2022-12-01',
      purchasePrice: '872.40',
      purchaseShop: 'Test Dive Shop',
      retiredAt: null,
      serviceDueAt: '2027-01-01',
      inactive: false,
      weightKg: '1.100',
      notes: 'Last serviced 2025-01-01 by Test Dive Shop',
    })
  })

  test('retires non-active gear, converts pounds, and names unnamed items', () => {
    const mapped = mapGarminEquipment({
      gearId: '9',
      type: 'BCD',
      detail: {
        brand: 'Scubapro',
        model: 'Hydros Pro',
        status: 'RETIRED',
        surfaceWeight: 2,
        surfaceWeightUnit: 'POUND',
        lastModifiedTs: '2026-02-03T10:00:00Z',
        serialNumber: 12345,
      },
    })
    expect(mapped).toMatchObject({
      name: 'Scubapro Hydros Pro',
      category: 'BCD',
      inactive: true,
      retiredAt: '2026-02-03',
      weightKg: '0.907',
      serialNumber: '12345',
      notes: null,
    })
  })

  test('certifications are not gear, and carry name and date only', () => {
    const certification = {
      gearId: '463947',
      type: 'CERTIFICATION',
      detail: { name: 'Deep Diver', type: 'CERTIFICATION', dateOfFirstUse: '2025-01-01' },
    }
    expect(isGarminCertification(certification)).toBe(true)
    expect(mapGarminEquipment(certification)).toBeNull()
    expect(mapGarminCertification(certification)).toEqual({
      externalId: '463947',
      name: 'Deep Diver',
      certifiedAt: '2025-01-01',
    })
    expect(mapGarminCertification(regulator)).toBeNull()
  })

  test('matching keys ignore case and spacing', () => {
    expect(normalizedGearName('  Atomic  B2   Regulator ')).toBe('atomic b2 regulator')
  })
})
