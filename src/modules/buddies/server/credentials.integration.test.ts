import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { closeDb, getDb } from '@/db'
import {
  agencies,
  buddies,
  buddyAgencyMemberships,
  buddyCertifications,
} from '@/db/schema'
import {
  deleteBuddyAgencyMembership,
  deleteBuddyCertification,
  saveBuddyAgencyMembership,
  saveBuddyCertification,
} from './credentials.server'

const enabled = process.env.RUN_IMPORT_INTEGRATION_TESTS === 'true'

describe.skipIf(!enabled)('buddy credential mutations database contract', () => {
  let agencyId: string
  let buddyId: string

  beforeAll(async () => {
    const db = getDb()
    await db.delete(buddyAgencyMemberships)
    await db.delete(buddyCertifications)
    await db.delete(buddies)
    await db
      .delete(agencies)
      .where(eq(agencies.normalizedName, 'test-buddy-credential-agency'))
    const [agency] = await db
      .insert(agencies)
      .values({
        name: 'Test Buddy Credential Agency',
        normalizedName: 'test-buddy-credential-agency',
      })
      .returning({ id: agencies.id })
    if (!agency) throw new Error('Seed agency was not created')
    agencyId = agency.id
    const [buddy] = await db
      .insert(buddies)
      .values({ firstName: 'Credentialed' })
      .returning({ id: buddies.id })
    if (!buddy) throw new Error('Seed buddy was not created')
    buddyId = buddy.id
  })

  afterAll(async () => {
    await closeDb()
  })

  test('rejects a certification against a nonexistent agency, then saves, updates, and deletes it', async () => {
    const db = getDb()
    await expect(
      saveBuddyCertification(buddyId, 'new', {
        agencyId: '11111111-1111-4111-8111-111111111111',
        name: 'Rescue Diver',
      }),
    ).rejects.toThrow('Select an existing agency')

    const certificationId = await saveBuddyCertification(buddyId, 'new', {
      agencyId,
      name: 'Rescue Diver',
    })
    const [certification] = await db
      .select()
      .from(buddyCertifications)
      .where(eq(buddyCertifications.id, certificationId))
    expect(certification).toMatchObject({ buddyId, agencyId, name: 'Rescue Diver' })

    await saveBuddyCertification(buddyId, certificationId, { name: 'Divemaster' })
    const [updated] = await db
      .select()
      .from(buddyCertifications)
      .where(eq(buddyCertifications.id, certificationId))
    expect(updated?.name).toBe('Divemaster')

    await deleteBuddyCertification(certificationId)
    expect(
      await db
        .select()
        .from(buddyCertifications)
        .where(eq(buddyCertifications.id, certificationId)),
    ).toHaveLength(0)
    await expect(deleteBuddyCertification(certificationId)).rejects.toThrow(
      'The record was not found',
    )
  })

  test('reports a friendly error instead of a raw constraint violation for a duplicate membership', async () => {
    const db = getDb()
    const membershipId = await saveBuddyAgencyMembership(buddyId, 'new', {
      agencyId,
      memberNumber: 'M-1',
    })
    const [membership] = await db
      .select()
      .from(buddyAgencyMemberships)
      .where(eq(buddyAgencyMemberships.id, membershipId))
    expect(membership).toMatchObject({ buddyId, agencyId, memberNumber: 'M-1' })

    await expect(
      saveBuddyAgencyMembership(buddyId, 'new', { agencyId, memberNumber: 'M-2' }),
    ).rejects.toThrow('This buddy already has a number for that agency')

    await deleteBuddyAgencyMembership(membershipId)
    expect(
      await db
        .select()
        .from(buddyAgencyMemberships)
        .where(eq(buddyAgencyMemberships.id, membershipId)),
    ).toHaveLength(0)
  })
})
