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
  test('normalizes a DiveMate logbook and its linked records', async () => {
    const { database, path } = fixtureDatabase()
    database.exec(`
      CREATE TABLE DBInfo (DBVersion TEXT, PrgName TEXT, UUID TEXT, Updated TEXT);
      INSERT INTO DBInfo VALUES (
        '4.0', 'DiveMate', 'database-uuid', '2026-07-26T12:00:00'
      );
      CREATE TABLE Personal (
        ID INTEGER, FirstName TEXT, LastName TEXT, Email TEXT, Mobile TEXT,
        Birthdate TEXT, Bloodgroup TEXT, EmergContact TEXT,
        EmergContactNumber TEXT, DiveInsurance TEXT, Comments TEXT,
        UUID TEXT, Updated TEXT, Street TEXT, Zip TEXT, City TEXT,
        State TEXT, Country TEXT, EmergEmail TEXT
      );
      INSERT INTO Personal VALUES (
        1, 'Ada', 'Diver', 'ada@example.test', '+1', '1990-01-02', 'A+',
        'Grace', '+2', 'insured', 'notes', 'diver-uuid', '2026-01-01',
        '1 Ocean Road', '12345', 'Dive City', 'Coast', 'Example',
        'grace@example.test'
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
        Updated TEXT, Street TEXT, Zip TEXT, State TEXT
      );
      INSERT INTO Buddy VALUES (
        4, 'Sam', 'Buddy', NULL, NULL, NULL, NULL, NULL, NULL,
        'buddy-uuid', '2026-01-01', '2 Reef Road', '54321', 'Bay'
      );
      CREATE TABLE Equipment (
        ID INTEGER, Name TEXT, Object TEXT, Category TEXT, Manufacturer TEXT,
        Serial TEXT, DateP TEXT, DateR TEXT, DateRN TEXT, Inactive INTEGER,
        Weight REAL, Comments TEXT, Photo BLOB, UUID TEXT, Updated TEXT
        , DiverID INTEGER, Info TEXT, Price REAL, Shop TEXT, TypeID INTEGER,
        Val1 REAL, Val2 REAL, Val3 INTEGER
      );
      INSERT INTO Equipment VALUES (
        9, 'Dive computer', 'Model X', 'Computers', 'Example', '123',
        '2025-01-01', NULL, NULL, 0, 0.2, NULL, X'0102',
        'equipment-uuid', '2026-01-01', 1, 'Bluetooth device', 500,
        'Dive Center', 11, 12, 0, 2
      );
      INSERT INTO Equipment VALUES (
        10, 'Basic set', NULL, '---SET', NULL, NULL,
        NULL, NULL, NULL, 0, NULL, 'Reusable set', NULL,
        'set-uuid', '2026-01-02', 1, '9', NULL,
        NULL, 9, 0, 0, 0
      );
      CREATE TABLE Brevets (
        ID INTEGER, DiverID INTEGER, Brevet TEXT, Org TEXT, Number TEXT,
        CertDate TEXT, Instructor TEXT, InstructorNo TEXT, UUID TEXT,
        Updated TEXT, Scan1Path TEXT, Scan2Path TEXT, SortOrd INTEGER,
        Scan1 BLOB, Scan2 BLOB
      );
      INSERT INTO Brevets VALUES (
        3, 1, 'Advanced', 'Example Org', 'C-123', '2024-06-01',
        'Instructor', 'I-1', 'cert-uuid', '2026-01-01',
        '/media/front.jpg', '/media/back.jpg', 3,
        X'FFD8FF00', X'89504E470D0A1A0A'
      );
      CREATE TABLE Shop (ID INTEGER, ShopName TEXT, UUID TEXT, Updated TEXT);
      INSERT INTO Shop VALUES (2, 'Dive Center', 'shop-uuid', '2026-01-01');
      CREATE TABLE Divetype (
        ID INTEGER, Typename TEXT, SortOrd INTEGER, UUID TEXT, Updated TEXT
      );
      INSERT INTO Divetype VALUES (5, 'Tieftauchgang', 1, 'type-uuid', '2026-01-01');
      INSERT INTO Divetype VALUES (6, 'Höhlentauchgang', 2, 'cave-uuid', '2026-01-01');
      INSERT INTO Divetype VALUES (7, 'Ausbildung', 3, 'training-uuid', '2026-01-01');
      INSERT INTO Divetype VALUES (8, 'Custom type', 4, 'custom-uuid', '2026-01-01');
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
        EquipWeight REAL, Deco INTEGER, Buddy TEXT, Profile10 TEXT,
        Status INTEGER
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
        'must not be stored', 1
      );
      CREATE TABLE Tank (
        ID INTEGER, LogID INTEGER, TankID INTEGER, Name TEXT, SortOrd INTEGER, Tanktype INTEGER,
        Tanksize REAL, PresS REAL, PresE REAL, O2 REAL, He REAL,
        BreathingTime INTEGER, UUID TEXT, Updated TEXT, PresW REAL,
        SupplyType INTEGER, Weight REAL, DivePhase INTEGER
      );
      INSERT INTO Tank VALUES (
        12, 11, 2, 'Back gas', 1, 0, 12, 200, 50, 32, 0, 2900,
        'tank-uuid', '2026-07-26', 232, 4, 12.4, 2
      );
      CREATE TABLE Pictures (
        ID INTEGER, LogID INTEGER, PlaceID INTEGER, BuddyID INTEGER,
        EquipmentID INTEGER, DiverID INTEGER, Path TEXT, Description TEXT,
        SortOrd INTEGER, UUID TEXT, Updated TEXT, Graphic BLOB
      );
      INSERT INTO Pictures VALUES (
        13, 11, NULL, NULL, NULL, 1, '/media/dive.jpg', 'Dive photo', 1,
        'picture-uuid', '2026-07-26', X'89504E470D0A1A0A'
      );
      INSERT INTO Pictures VALUES (
        14, 11, NULL, NULL, NULL, 1,
        '/storage/emulated/0/DiveMate/Signatures/Signature_260726151343.png',
        NULL, 2, 'signature-uuid', '2026-07-26', NULL
      );
    `)
    database.close()

    const snapshot = await parseDiveMateDatabase(path)

    expect(snapshot.sourceTables).toContain('Logbook')
    expect(snapshot.databaseVersion).toBe('4.0')
    expect(snapshot.databaseProgram).toBe('DiveMate')
    expect(snapshot.databaseUuid).toBe('database-uuid')
    expect(snapshot.databaseUpdatedAt).toBe('2026-07-26T12:00:00')
    expect(snapshot.diveTypes.map(({ name }) => name)).toEqual([
      'Deep dive',
      'Cave dive',
      'Training',
      'Custom type',
    ])
    expect(snapshot.diveTypes[0]?.sourcePayload.Typename).toBe('Tieftauchgang')
    expect(snapshot.dives).toHaveLength(1)
    expect(snapshot.dives[0]).toMatchObject({
      externalId: '11',
      diverExternalId: '1',
      siteExternalId: '7',
      buddyExternalIds: ['4'],
      equipmentExternalIds: ['9'],
      captureSource: 'computer',
      diveDate: '2026-07-26',
      entryTime: '14:29:00',
      durationSeconds: 2910,
      maximumDepthMeters: '31.2',
      maximumPpo2: '1.31',
      equipmentWeightKg: '12.4',
      decompressionDive: true,
      buddyName: 'Legacy Buddy',
    })
    expect(snapshot.divers[0]).toMatchObject({
      street: '1 Ocean Road',
      postalCode: '12345',
      city: 'Dive City',
      state: 'Coast',
      country: 'Example',
      emergencyEmail: 'grace@example.test',
    })
    expect(snapshot.buddies[0]).toMatchObject({
      street: '2 Reef Road',
      postalCode: '54321',
      state: 'Bay',
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
      workingPressureBar: '232',
      supplyTypeCode: 4,
      weightKg: '12.4',
      divePhaseCode: 2,
    })
    expect(snapshot.equipment[0]).toMatchObject({
      diverExternalId: '1',
      information: 'Bluetooth device',
      purchasePrice: '500',
      purchaseShop: 'Dive Center',
      equipmentTypeCode: 11,
      sourceValue1: '12',
      sourceValue2: '0',
      sourceValue3: 2,
      isSet: false,
      memberExternalIds: [],
    })
    expect(snapshot.equipment[1]).toMatchObject({
      name: 'Basic set',
      category: '---SET',
      equipmentTypeCode: 9,
      isSet: true,
      memberExternalIds: ['9'],
    })
    expect(snapshot.certifications[0]).toMatchObject({
      scan1Path: '/media/front.jpg',
      scan2Path: '/media/back.jpg',
      sortOrder: 3,
      scan1MimeType: 'image/jpeg',
      scan2MimeType: 'image/png',
    })
    expect(snapshot.certifications[0]?.sourcePayload.Scan1).toEqual({
      omittedBinaryBytes: 4,
    })
    expect(snapshot.pictures[0]).toMatchObject({
      externalId: '13',
      diveExternalId: '11',
      diverExternalId: '1',
      path: '/media/dive.jpg',
      description: 'Dive photo',
      sortOrder: 1,
      mimeType: 'image/png',
      kind: 'photo',
    })
    expect(snapshot.pictures[0]?.imageBytes).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
    expect(snapshot.pictures[0]?.sourcePayload.Graphic).toEqual({
      omittedBinaryBytes: 8,
    })
    expect(snapshot.pictures[1]).toMatchObject({
      externalId: '14',
      kind: 'signature',
      path: '/storage/emulated/0/DiveMate/Signatures/Signature_260726151343.png',
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

  test('accepts a partial database and ignores records without stable IDs', async () => {
    const { database, path } = fixtureDatabase()
    database.exec(`
      CREATE TABLE Logbook (ID INTEGER, Divedate TEXT);
      INSERT INTO Logbook VALUES (NULL, '2026-01-01');
    `)
    database.close()

    const snapshot = await parseDiveMateDatabase(path)

    expect(snapshot.dives).toEqual([])
    expect(snapshot.sites).toEqual([])
    expect(snapshot.certifications).toEqual([])
    expect(snapshot.profileSamples).toEqual([])
  })

  test('ignores malformed fixed-width profiles instead of inventing samples', async () => {
    const { database, path } = fixtureDatabase()
    database.exec(`
      CREATE TABLE Logbook (
        ID INTEGER, Divedate TEXT, ProfileInt INTEGER, Profile TEXT
      );
      INSERT INTO Logbook VALUES (1, '2026-01-01', 10, '00100000000x');
      INSERT INTO Logbook VALUES (2, '2026-01-02', 0, '001000000000');
    `)
    database.close()

    const snapshot = await parseDiveMateDatabase(path)

    expect(snapshot.dives).toHaveLength(2)
    expect(snapshot.profileSamples).toEqual([])
  })

  test('ignores discarded status 2 dives and their profiles', async () => {
    const { database, path } = fixtureDatabase()
    database.exec(`
      CREATE TABLE Logbook (
        ID INTEGER, Divedate TEXT, Status INTEGER, ProfileInt INTEGER, Profile TEXT
      );
      INSERT INTO Logbook VALUES (1, '2026-01-01', 2, 10, '001000000000');
      INSERT INTO Logbook VALUES (2, '2026-01-02', 0, 10, NULL);
      INSERT INTO Logbook VALUES (3, '2026-01-03', 1, 10, '001000000000');
    `)
    database.close()

    const snapshot = await parseDiveMateDatabase(path)

    expect(
      snapshot.dives.map(({ externalId, captureSource }) => ({
        externalId,
        captureSource,
      })),
    ).toEqual([
      { externalId: '2', captureSource: 'manual' },
      { externalId: '3', captureSource: 'computer' },
    ])
    expect(snapshot.profileSamples.map((sample) => sample.diveExternalId)).toEqual(['3'])
  })
})
