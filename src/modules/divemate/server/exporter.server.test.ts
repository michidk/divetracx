import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ExportSnapshot } from '@/modules/export/types'
import { parseDiveMateDatabase } from '../parser'
import { rewriteDiveMateDatabase } from './exporter.server'
import { openSqlite } from './sqlite.server'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('canonical DiveMate export', () => {
  test('exports a non-DiveMate canonical dive and its profile', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'divetracx-divemate-export-'))
    temporaryDirectories.push(directory)
    const path = join(directory, 'DiveMate.ddb')
    const database = await openSqlite(path)
    database.exec(`
      CREATE TABLE DBInfo (DBVersion TEXT, PrgName TEXT, UUID TEXT, Updated TEXT);
      INSERT INTO DBInfo VALUES ('4.0', 'DiveMate', 'template', NULL);
      CREATE TABLE Place (
        ID INTEGER, Place TEXT, Country TEXT, Region TEXT, WaterName TEXT,
        Lat TEXT, Lon TEXT, MaxDepth REAL, Altitude INTEGER, Difficulty TEXT,
        Rating INTEGER, Water INTEGER, Comments TEXT, UUID TEXT, Updated TEXT
      );
      CREATE TABLE Equipment (
        ID INTEGER, Name TEXT, Object TEXT, Category TEXT, Manufacturer TEXT,
        Serial TEXT, DateP TEXT, DateR TEXT, DateRN TEXT, Inactive INTEGER,
        Weight REAL, Comments TEXT, UUID TEXT, Updated TEXT, DiverID INTEGER,
        Info TEXT, Price REAL, Shop TEXT, TypeID INTEGER
      );
      CREATE TABLE Logbook (
        ID INTEGER, DiverID INTEGER, PlaceID INTEGER, ShopID INTEGER,
        TypeOfDive INTEGER, BuddyIDs TEXT, UsedEquip TEXT, Number INTEGER,
        Divedate TEXT, Entrytime TEXT, UTCoffset INTEGER, Divetime REAL,
        Surfint TEXT, Depth REAL, DepthAvg REAL, Airtemp REAL, Watertemp REAL,
        Weight REAL, VisHor TEXT, UWCurrent TEXT, Waves TEXT, Weather TEXT,
        Water INTEGER, Entry INTEGER, Rating INTEGER, Computer TEXT,
        Divesuit TEXT, Boat TEXT, Divemaster TEXT, Comments TEXT,
        UUID TEXT, Updated TEXT, ProfileInt INTEGER, Profile TEXT,
        Profile2 TEXT, Profile3 TEXT, Profile4 TEXT, MaxPPO2 REAL,
        EquipWeight REAL, Deco INTEGER, Buddy TEXT
      );
    `)

    const now = new Date('2026-09-01T12:00:00Z')
    const snapshot = {
      format: 'divetracx-backup',
      version: 8,
      exportedAt: now.toISOString(),
      data: {
        divers: [],
        diveSites: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Garmin site',
            country: null,
            region: null,
            waterName: null,
            latitude: '24.7061444',
            longitude: '35.0855278',
            maximumDepthMeters: '30',
            altitudeMeters: null,
            difficulty: null,
            rating: null,
            waterType: null,
            notes: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
        buddies: [],
        equipment: [
          {
            id: '55555555-5555-5555-5555-555555555555',
            diverId: null,
            name: 'Primary mask',
            category: 'Mask',
            manufacturer: null,
            model: null,
            serialNumber: null,
            information: null,
            purchasedAt: null,
            purchasePrice: null,
            purchaseShop: null,
            retiredAt: null,
            serviceDueAt: null,
            inactive: false,
            weightKg: null,
            notes: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
        equipmentSets: [
          {
            id: '66666666-6666-6666-6666-666666666666',
            name: 'Travel set',
            notes: 'Lightweight setup',
            inactive: false,
            createdAt: now,
            updatedAt: now,
          },
        ],
        equipmentSetItems: [
          {
            equipmentSetId: '66666666-6666-6666-6666-666666666666',
            equipmentId: '55555555-5555-5555-5555-555555555555',
            sortOrder: 0,
          },
        ],
        certifications: [],
        shops: [],
        diveTypes: [],
        dives: [
          {
            id: '22222222-2222-2222-2222-222222222222',
            captureSource: 'computer' as const,
            diverId: null,
            siteId: '11111111-1111-1111-1111-111111111111',
            shopId: null,
            diveTypeId: null,
            number: 7,
            diveDate: '2026-08-31',
            entryTime: '09:30:00',
            utcOffsetMinutes: 120,
            durationSeconds: 1800,
            surfaceIntervalSeconds: null,
            maximumDepthMeters: '20',
            averageDepthMeters: '12',
            airTemperatureCelsius: null,
            waterTemperatureCelsius: '24',
            weightKg: null,
            equipmentWeightKg: null,
            maximumPpo2: null,
            decompressionDive: false,
            visibility: null,
            current: null,
            waves: null,
            weather: null,
            waterType: null,
            entryType: null,
            rating: null,
            computer: 'Garmin Descent',
            suit: null,
            boat: null,
            divemaster: null,
            legacyBuddyText: null,
            notes: 'Imported through the canonical model',
            createdAt: now,
            updatedAt: now,
          },
        ],
        diveBuddies: [],
        diveEquipment: [
          {
            id: '77777777-7777-7777-7777-777777777777',
            diveId: '22222222-2222-2222-2222-222222222222',
            equipmentId: '55555555-5555-5555-5555-555555555555',
          },
        ],
        diveProfileSamples: [
          {
            id: '33333333-3333-3333-3333-333333333333',
            diveId: '22222222-2222-2222-2222-222222222222',
            sampleIndex: 0,
            elapsedSeconds: 0,
            depthMeters: '0',
            temperatureCelsius: '24',
            pressureBar: null,
            tank1PressureBar: null,
            tank2PressureBar: null,
            decoCeilingMeters: null,
            tankNumber: null,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: '44444444-4444-4444-4444-444444444444',
            diveId: '22222222-2222-2222-2222-222222222222',
            sampleIndex: 1,
            elapsedSeconds: 30,
            depthMeters: '20',
            temperatureCelsius: '23',
            pressureBar: null,
            tank1PressureBar: null,
            tank2PressureBar: null,
            decoCeilingMeters: null,
            tankNumber: null,
            createdAt: now,
            updatedAt: now,
          },
        ],
        tanks: [],
        pictures: [],
        importRuns: [],
      },
    } satisfies ExportSnapshot

    rewriteDiveMateDatabase(database, snapshot)
    database.close()
    const exported = await parseDiveMateDatabase(path)

    expect(exported.dives).toHaveLength(1)
    expect(exported.dives[0]).toMatchObject({
      number: 7,
      diveDate: '2026-08-31',
      durationSeconds: 1800,
      maximumDepthMeters: '20',
      computer: 'Garmin Descent',
    })
    expect(exported.sites[0]?.name).toBe('Garmin site')
    const exportedItem = exported.equipment.find((item) => !item.isSet)
    const exportedSet = exported.equipment.find((item) => item.isSet)
    if (!exportedItem) throw new Error('Exported equipment item is missing')
    expect(exportedItem?.name).toBe('Primary mask')
    expect(exportedSet).toMatchObject({
      name: 'Travel set',
      category: '---SET',
      equipmentTypeCode: 9,
      memberExternalIds: [exportedItem.externalId],
    })
    expect(exported.dives[0]?.equipmentExternalIds).toEqual([exportedItem.externalId])
    expect(exported.profileSamples).toHaveLength(2)
    expect(exported.profileSamples[1]).toMatchObject({
      elapsedSeconds: 30,
      depthMeters: '20.0',
    })
  })
})
