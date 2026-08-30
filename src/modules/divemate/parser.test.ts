import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseDiveMateDatabase } from './parser'

const temporaryDirectories: string[] = []

function fixtureDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'divetracx-parser-test-'))
  temporaryDirectories.push(directory)
  const path = join(directory, 'DiveMate.ddb')
  return { database: new Database(path), path }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('parseDiveMateDatabase', () => {
  test('normalizes a DiveMate logbook and its linked records', () => {
    const { database, path } = fixtureDatabase()
    database.exec(`
      CREATE TABLE DBInfo (DBVersion TEXT);
      INSERT INTO DBInfo VALUES ('4.0');
      CREATE TABLE Personal (
        ID INTEGER, FirstName TEXT, LastName TEXT, Email TEXT, Mobile TEXT,
        Birthdate TEXT, Bloodgroup TEXT, EmergContact TEXT,
        EmergContactNumber TEXT, DiveInsurance TEXT, Comments TEXT,
        UUID TEXT, Updated TEXT
      );
      INSERT INTO Personal VALUES (
        1, 'Ada', 'Diver', 'ada@example.test', '+1', '1990-01-02', 'A+',
        'Grace', '+2', 'insured', 'notes', 'diver-uuid', '2026-01-01'
      );
      CREATE TABLE Place (
        ID INTEGER, Place TEXT, Country TEXT, Region TEXT, WaterName TEXT,
        Lat TEXT, Lon TEXT, MaxDepth REAL, Altitude INTEGER, Difficulty TEXT,
        Rating INTEGER, Water INTEGER, Comments TEXT, UUID TEXT, Updated TEXT
      );
      INSERT INTO Place VALUES (
        7, 'Blue Hole', 'Example', 'Coast', 'Sea', '24°42''22.12"N',
        '35°05''7.90"E', 40, 0, 'Medium', 5, 1, 'site notes',
        'site-uuid', '2026-01-01'
      );
      CREATE TABLE Buddy (
        ID INTEGER, FirstName TEXT, LastName TEXT, Email TEXT, Mobile TEXT,
        Phone TEXT, City TEXT, Country TEXT, Comments TEXT, UUID TEXT,
        Updated TEXT
      );
      INSERT INTO Buddy VALUES (
        4, 'Sam', 'Buddy', NULL, NULL, NULL, NULL, NULL, NULL,
        'buddy-uuid', '2026-01-01'
      );
      CREATE TABLE Equipment (
        ID INTEGER, Name TEXT, Object TEXT, Category TEXT, Manufacturer TEXT,
        Serial TEXT, DateP TEXT, DateR TEXT, DateRN TEXT, Inactive INTEGER,
        Weight REAL, Comments TEXT, Photo BLOB, UUID TEXT, Updated TEXT
      );
      INSERT INTO Equipment VALUES (
        9, 'Dive computer', 'Model X', 'Computers', 'Example', '123',
        '2025-01-01', NULL, NULL, 0, 0.2, NULL, X'0102',
        'equipment-uuid', '2026-01-01'
      );
      CREATE TABLE Brevets (
        ID INTEGER, DiverID INTEGER, Brevet TEXT, Org TEXT, Number TEXT,
        CertDate TEXT, Instructor TEXT, InstructorNo TEXT, UUID TEXT,
        Updated TEXT
      );
      INSERT INTO Brevets VALUES (
        3, 1, 'Advanced', 'Example Org', 'C-123', '2024-06-01',
        'Instructor', 'I-1', 'cert-uuid', '2026-01-01'
      );
      CREATE TABLE Shop (ID INTEGER, ShopName TEXT, UUID TEXT, Updated TEXT);
      INSERT INTO Shop VALUES (2, 'Dive Center', 'shop-uuid', '2026-01-01');
      CREATE TABLE Divetype (
        ID INTEGER, Typename TEXT, SortOrd INTEGER, UUID TEXT, Updated TEXT
      );
      INSERT INTO Divetype VALUES (5, 'Deep', 1, 'type-uuid', '2026-01-01');
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
        EquipWeight REAL, Deco INTEGER, Buddy TEXT, Profile10 TEXT
      );
      INSERT INTO Logbook VALUES (
        11, 1, 7, 2, 5, '4', '9', 42, '2026-07-26', '14:29:00',
        120, 48.5, '01:30', 31.2, 16.4, 26, 22, 6.5, '15 m', 'low',
        'calm', 'sunny', 1, 2, 5, 'Computer', '5 mm', 'Boat', 'Guide',
        'great dive', 'dive-uuid', '2026-07-26', 30,
        '000000000000001500000000012300000000',
        '220200000002151500100020000001000',
        '199520000000001950150000000019001450000000',
        '000099000010002003005001006', 1.31, 12.4, 1, 'Legacy Buddy',
        'must not be stored'
      );
      CREATE TABLE Tank (
        ID INTEGER, LogID INTEGER, TankID INTEGER, Name TEXT, SortOrd INTEGER, Tanktype INTEGER,
        Tanksize REAL, PresS REAL, PresE REAL, O2 REAL, He REAL,
        BreathingTime INTEGER, UUID TEXT, Updated TEXT
      );
      INSERT INTO Tank VALUES (
        12, 11, 2, 'Back gas', 1, 0, 12, 200, 50, 32, 0, 2900,
        'tank-uuid', '2026-07-26'
      );
    `)
    database.close()

    const snapshot = parseDiveMateDatabase(path)

    expect(snapshot.databaseVersion).toBe('4.0')
    expect(snapshot.dives).toHaveLength(1)
    expect(snapshot.dives[0]).toMatchObject({
      externalId: '11',
      diverExternalId: '1',
      siteExternalId: '7',
      buddyExternalIds: ['4'],
      equipmentExternalIds: ['9'],
      diveDate: '2026-07-26',
      entryTime: '14:29:00',
      durationSeconds: 2910,
      maximumDepthMeters: '31.2',
      maximumPpo2: '1.31',
      equipmentWeightKg: '12.4',
      decompressionDive: true,
      legacyBuddyText: 'Legacy Buddy',
    })
    expect(snapshot.dives[0]?.sourcePayload).not.toHaveProperty('Profile10')
    expect(snapshot.sites[0]).toMatchObject({
      latitude: '24.7061444',
      longitude: '35.0855278',
    })
    expect(snapshot.tanks[0]).toMatchObject({
      diveExternalId: '11',
      computerTankNumber: 2,
      oxygenPercent: '32',
    })
    expect(snapshot.profileSamples).toEqual([
      expect.objectContaining({
        externalId: '11:0',
        diveExternalId: '11',
        sampleIndex: 0,
        elapsedSeconds: 0,
        depthMeters: '0.0',
        temperatureCelsius: '22.0',
        pressureBar: '200.0',
        tank1PressureBar: '199.5',
        tank2PressureBar: '200.0',
        decoCeilingMeters: null,
        tankNumber: 1,
      }),
      expect.objectContaining({
        externalId: '11:1',
        sampleIndex: 1,
        elapsedSeconds: 30,
        depthMeters: '1.5',
        temperatureCelsius: '21.5',
        pressureBar: '150.0',
        tank1PressureBar: '195.0',
        tank2PressureBar: '150.0',
        decoCeilingMeters: '3',
        tankNumber: 2,
      }),
      expect.objectContaining({
        externalId: '11:2',
        sampleIndex: 2,
        elapsedSeconds: 60,
        depthMeters: '12.3',
        temperatureCelsius: '20.0',
        pressureBar: null,
        tank1PressureBar: '190.0',
        tank2PressureBar: '145.0',
        decoCeilingMeters: '6',
        tankNumber: 2,
      }),
    ])
    expect(snapshot.profileSamples[2]?.sourcePayload).toEqual({
      rawSample: '012300000000',
      rawAuxiliarySample: '20000001000',
      rawTransmitterSample: '19001450000000',
      rawDecompressionSample: '005001006',
      profileIntervalSeconds: 30,
    })
    expect(snapshot.equipment[0]?.sourcePayload.Photo).toEqual({
      omittedBinaryBytes: 2,
    })
  })

  test('accepts a partial database and ignores records without stable IDs', () => {
    const { database, path } = fixtureDatabase()
    database.exec(`
      CREATE TABLE Logbook (ID INTEGER, Divedate TEXT);
      INSERT INTO Logbook VALUES (NULL, '2026-01-01');
    `)
    database.close()

    const snapshot = parseDiveMateDatabase(path)

    expect(snapshot.dives).toEqual([])
    expect(snapshot.sites).toEqual([])
    expect(snapshot.certifications).toEqual([])
    expect(snapshot.profileSamples).toEqual([])
  })

  test('ignores malformed fixed-width profiles instead of inventing samples', () => {
    const { database, path } = fixtureDatabase()
    database.exec(`
      CREATE TABLE Logbook (
        ID INTEGER, Divedate TEXT, ProfileInt INTEGER, Profile TEXT
      );
      INSERT INTO Logbook VALUES (1, '2026-01-01', 10, '00100000000x');
      INSERT INTO Logbook VALUES (2, '2026-01-02', 0, '001000000000');
    `)
    database.close()

    const snapshot = parseDiveMateDatabase(path)

    expect(snapshot.dives).toHaveLength(2)
    expect(snapshot.profileSamples).toEqual([])
  })
})
