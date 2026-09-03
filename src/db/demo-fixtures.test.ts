import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { readdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { count, countDistinct } from 'drizzle-orm'
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite'
import { seedDemoDatabase } from './demo-fixtures'
import * as schema from './schema'

describe('demo fixtures', () => {
  let client: PGlite
  let database: PgliteDatabase<typeof schema>

  beforeAll(async () => {
    client = await PGlite.create('memory://')
    const migrationDirectory = resolve('drizzle')
    const migrationFiles = (await readdir(migrationDirectory))
      .filter((filename) => filename.endsWith('.sql'))
      .sort()
    for (const filename of migrationFiles) {
      const sql = await readFile(resolve(migrationDirectory, filename), 'utf8')
      await client.exec(sql.replaceAll('--> statement-breakpoint', ''))
    }
    database = drizzle(client, { schema })
    await seedDemoDatabase(database)
  }, 30_000)

  afterAll(async () => {
    await client.close()
  })

  test('contains exactly seven dives with recorded profiles', async () => {
    const seededDives = await database.select().from(schema.dives)
    const samples = await database.select().from(schema.diveProfileSamples)
    const [diveTotals] = await database.select({ count: count() }).from(schema.dives)
    const [profileTotals] = await database
      .select({ count: countDistinct(schema.diveProfileSamples.diveId) })
      .from(schema.diveProfileSamples)

    expect(diveTotals?.count).toBe(7)
    expect(profileTotals?.count).toBe(7)
    for (const dive of seededDives) {
      const profile = samples.filter((sample) => sample.diveId === dive.id)
      expect(profile.length).toBeGreaterThan(1)
      expect(Math.max(...profile.map((sample) => sample.elapsedSeconds))).toBe(
        dive.durationSeconds,
      )
      expect(Math.max(...profile.map((sample) => Number(sample.depthMeters)))).toBe(
        Number(dive.maximumDepthMeters),
      )
    }
  })

  test('seeds a profile portrait and photos for only three dives', async () => {
    const seededPictures = await database.select().from(schema.pictures)

    expect(seededPictures).toHaveLength(4)
    expect(seededPictures.filter((picture) => picture.kind === 'profile')).toHaveLength(1)
    expect(
      new Set(
        seededPictures
          .filter((picture) => picture.kind === 'photo')
          .map((picture) => picture.diveId),
      ).size,
    ).toBe(3)
  })

  test('seeds two PADI certifications and the fictional Wreck Diver card', async () => {
    const seededCertifications = await database.select().from(schema.certifications)
    const seededAgencies = await database.select().from(schema.agencies)
    const padi = seededAgencies.find((agency) => agency.code === 'padi')

    expect(padi).toBeDefined()
    expect(seededCertifications).toHaveLength(2)
    expect(seededCertifications.every((item) => item.agencyId === padi?.id)).toBe(true)
    expect(seededCertifications.map((item) => item.name).sort()).toEqual([
      'Open Water Diver',
      'Wreck Diver',
    ])
    expect(
      seededCertifications.find((item) => item.name === 'Wreck Diver'),
    ).toMatchObject({
      certifiedAt: '2025-07-10',
      scan1StoragePath: 'demo/wreck-diver-front.webp',
      scan2StoragePath: 'demo/wreck-diver-back.webp',
    })
  })

  test('does not seed contact, insurance, serial-number, or integration data', async () => {
    const [diver] = await database.select().from(schema.divers)
    const gear = await database.select().from(schema.equipment)
    const [externalRecordTotals] = await database
      .select({ count: count() })
      .from(schema.externalRecords)

    expect(diver).toMatchObject({
      email: null,
      phone: null,
      street: null,
      birthDate: null,
      emergencyContact: null,
      insuranceNumber: null,
    })
    expect(gear.every((item) => item.serialNumber === null)).toBe(true)
    expect(externalRecordTotals?.count).toBe(0)
  })
})
