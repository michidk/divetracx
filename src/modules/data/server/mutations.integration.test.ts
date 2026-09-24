import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { closeDb, getDb } from '@/db'
import {
  agencies,
  agencyMemberships,
  buddies,
  buddyAgencyMemberships,
  buddyCertifications,
  certifications,
  divers,
  diveSites,
  equipment,
  externalRecordLinks,
  externalRecords,
  integrations,
} from '@/db/schema'
import { getStorage } from '@/lib/storage'
import type { EditorValues } from '../entities'
import { deleteDataRecord, saveDataRecord } from './mutations.server'

const enabled = process.env.RUN_IMPORT_INTEGRATION_TESTS === 'true'
const INTEGRATION_KEY = 'test-data-mutations'

describe.skipIf(!enabled)('manual generic data mutations database contract', () => {
  let storageDir: string
  let agencyId: string

  beforeAll(async () => {
    storageDir = await mkdtemp(join(tmpdir(), 'divetracx-data-mutations-'))
    process.env.STORAGE_PROVIDER = 'local'
    process.env.STORAGE_PATH = storageDir
    process.env.STORAGE_URL = '/media'

    const db = getDb()
    await db.delete(externalRecordLinks)
    await db.delete(externalRecords)
    await db.delete(integrations).where(eq(integrations.key, INTEGRATION_KEY))
    await db.delete(buddyAgencyMemberships)
    await db.delete(buddyCertifications)
    await db.delete(agencyMemberships)
    await db.delete(certifications)
    await db.delete(diveSites)
    await db.delete(buddies)
    await db.delete(equipment)
    await db.delete(divers)
    await db.insert(divers).values({ firstName: 'Primary' })
    // Built-in agencies such as PADI are already seeded by migrations, so a
    // distinct name avoids colliding with their unique normalized name; any
    // leftover row from a previous run of this suite is cleared first.
    await db.delete(agencies).where(eq(agencies.normalizedName, 'test-certifying-agency'))
    const [agency] = await db
      .insert(agencies)
      .values({
        name: 'Test Certifying Agency',
        normalizedName: 'test-certifying-agency',
      })
      .returning({ id: agencies.id })
    if (!agency) throw new Error('Seed agency was not created')
    agencyId = agency.id
  })

  afterAll(async () => {
    await closeDb()
    await rm(storageDir, { recursive: true, force: true })
  })

  test('saves and updates a site, then deletes it after removing its provenance', async () => {
    const db = getDb()
    const created: EditorValues = {
      name: 'Blue Hole',
      country: 'Belize',
      latitude: '17.3',
      longitude: '-87.5',
      maximumDepthMeters: '124',
      rating: '5',
    }
    const siteId = await saveDataRecord('sites', 'new', created)
    let [site] = await db.select().from(diveSites).where(eq(diveSites.id, siteId))
    expect(site).toMatchObject({
      name: 'Blue Hole',
      country: 'Belize',
      latitude: '17.3000000',
      rating: 5,
    })

    await saveDataRecord('sites', siteId, { ...created, name: 'Great Blue Hole' })
    ;[site] = await db.select().from(diveSites).where(eq(diveSites.id, siteId))
    expect(site?.name).toBe('Great Blue Hole')

    await db.insert(integrations).values({
      key: INTEGRATION_KEY,
      displayName: 'Test data mutation integration',
      capabilities: { fullImport: true, incrementalImport: true, export: false },
      supportedEntities: ['sites'],
    })
    const [externalRecord] = await db
      .insert(externalRecords)
      .values({
        integrationKey: INTEGRATION_KEY,
        entityType: 'site',
        identityKey: 'site-1',
        rawPayload: {},
        contentHash: 'hash-site',
      })
      .returning({ id: externalRecords.id })
    if (!externalRecord) throw new Error('Seed external record was not created')
    await db.insert(externalRecordLinks).values({
      externalRecordId: externalRecord.id,
      canonicalEntityType: 'dive_site',
      canonicalEntityId: siteId,
      role: 'produced',
    })

    await deleteDataRecord('sites', siteId)

    expect(
      await db.select().from(diveSites).where(eq(diveSites.id, siteId)),
    ).toHaveLength(0)
    expect(
      await db
        .select()
        .from(externalRecordLinks)
        .where(eq(externalRecordLinks.externalRecordId, externalRecord.id)),
    ).toHaveLength(0)
    await expect(deleteDataRecord('sites', siteId)).rejects.toThrow(
      'The record was not found',
    )
  })

  test('saves a buddy with emergency contact fields', async () => {
    const buddyId = await saveDataRecord('buddies', 'new', {
      firstName: 'Sam',
      lastName: 'Diver',
      emergencyContact: 'Jo Diver',
      emergencyPhone: '+1-555-0100',
      instructor: true,
    })
    const [buddy] = await getDb().select().from(buddies).where(eq(buddies.id, buddyId))
    expect(buddy).toMatchObject({
      firstName: 'Sam',
      emergencyContact: 'Jo Diver',
      emergencyPhone: '+1-555-0100',
      instructor: true,
    })
  })

  test('saves equipment under the primary diver', async () => {
    const db = getDb()
    const [primaryDiver] = await db.select({ id: divers.id }).from(divers).limit(1)
    if (!primaryDiver) throw new Error('Primary diver seed is missing')

    const equipmentId = await saveDataRecord('equipment', 'new', {
      name: 'Regulator',
      manufacturer: 'Atomic',
      weightKg: '2.4',
    })
    const [item] = await db.select().from(equipment).where(eq(equipment.id, equipmentId))
    expect(item).toMatchObject({
      name: 'Regulator',
      manufacturer: 'Atomic',
      diverId: primaryDiver.id,
    })
  })

  test('rejects a certification without an existing agency, and cleans up stored scans on delete', async () => {
    await expect(
      saveDataRecord('certifications', 'new', { name: 'Open Water' }),
    ).rejects.toThrow('agencyId is required')
    await expect(
      saveDataRecord('certifications', 'new', {
        name: 'Open Water',
        // A well-formed but nonexistent UUID, so this exercises the "not
        // found" branch rather than the format-validation branch.
        agencyId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toThrow('Select an existing agency')

    const certificationId = await saveDataRecord('certifications', 'new', {
      name: 'Open Water',
      agencyId,
      certificationNumber: 'OW-123',
    })
    const db = getDb()
    const storage = getStorage()
    const scanPath = `certifications/${certificationId}-scan-1.jpg`
    const thumbnailPath = `certifications/${certificationId}-scan-1-thumb.jpg`
    await storage.upload(new Blob(['scan']), scanPath)
    await storage.upload(new Blob(['thumb']), thumbnailPath)
    expect(await storage.exists(scanPath)).toBe(true)
    expect(await storage.exists(thumbnailPath)).toBe(true)
    await db
      .update(certifications)
      .set({ scan1StoragePath: scanPath, scan1ThumbnailStoragePath: thumbnailPath })
      .where(eq(certifications.id, certificationId))

    await deleteDataRecord('certifications', certificationId)

    expect(
      await db
        .select()
        .from(certifications)
        .where(eq(certifications.id, certificationId)),
    ).toHaveLength(0)
    expect(await storage.exists(scanPath)).toBe(false)
    expect(await storage.exists(thumbnailPath)).toBe(false)
  })

  test('saves an agency membership and a buddy certification', async () => {
    const db = getDb()
    const membershipId = await saveDataRecord('agencyMemberships', 'new', {
      agencyId,
      memberNumber: 'M-1',
    })
    const [membership] = await db
      .select()
      .from(agencyMemberships)
      .where(eq(agencyMemberships.id, membershipId))
    expect(membership).toMatchObject({ agencyId, memberNumber: 'M-1' })

    const [buddy] = await db
      .insert(buddies)
      .values({ firstName: 'Cert holder' })
      .returning({ id: buddies.id })
    if (!buddy) throw new Error('Seed buddy was not created')
    const buddyCertificationId = await saveDataRecord('buddyCertifications', 'new', {
      agencyId,
      name: 'Rescue Diver',
      buddyId: buddy.id,
    })
    const [buddyCertification] = await db
      .select()
      .from(buddyCertifications)
      .where(eq(buddyCertifications.id, buddyCertificationId))
    expect(buddyCertification).toMatchObject({
      agencyId,
      name: 'Rescue Diver',
      buddyId: buddy.id,
    })
  })

  test('reports a friendly error instead of a raw constraint violation for a duplicate buddy agency membership', async () => {
    const db = getDb()
    const [buddy] = await db
      .insert(buddies)
      .values({ firstName: 'Duplicate target' })
      .returning({ id: buddies.id })
    if (!buddy) throw new Error('Seed buddy was not created')

    await saveDataRecord('buddyAgencyMemberships', 'new', {
      agencyId,
      memberNumber: 'D-1',
      buddyId: buddy.id,
    })
    await expect(
      saveDataRecord('buddyAgencyMemberships', 'new', {
        agencyId,
        memberNumber: 'D-2',
        buddyId: buddy.id,
      }),
    ).rejects.toThrow('This buddy already has a number for that agency')
  })
})
