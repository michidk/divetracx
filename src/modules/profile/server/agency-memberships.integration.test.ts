import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { closeDb, getDb } from '@/db'
import { agencies, agencyMemberships, divers, externalRecordLinks } from '@/db/schema'
import { deleteAgencyMembership, saveAgencyMembership } from './agency-memberships.server'

const enabled = process.env.RUN_IMPORT_INTEGRATION_TESTS === 'true'

describe.skipIf(!enabled)('manual agency membership mutations database contract', () => {
  let agencyId: string

  beforeAll(async () => {
    const db = getDb()
    await db.delete(externalRecordLinks)
    await db.delete(agencyMemberships)
    await db.delete(divers)
    await db.insert(divers).values({ firstName: 'Primary' })
    await db
      .delete(agencies)
      .where(eq(agencies.normalizedName, 'test-agency-membership-agency'))
    const [agency] = await db
      .insert(agencies)
      .values({
        name: 'Test Agency Membership Agency',
        normalizedName: 'test-agency-membership-agency',
      })
      .returning({ id: agencies.id })
    if (!agency) throw new Error('Seed agency was not created')
    agencyId = agency.id
  })

  afterAll(async () => {
    await closeDb()
  })

  test('rejects a membership against a nonexistent agency, assigns the primary diver, updates, and deletes it', async () => {
    const db = getDb()
    const [primaryDiver] = await db.select({ id: divers.id }).from(divers).limit(1)
    if (!primaryDiver) throw new Error('Primary diver seed is missing')

    await expect(
      saveAgencyMembership('new', {
        agencyId: '11111111-1111-4111-8111-111111111111',
        memberNumber: 'M-1',
      }),
    ).rejects.toThrow('Select an existing agency')

    const membershipId = await saveAgencyMembership('new', {
      agencyId,
      memberNumber: 'M-1',
    })
    const [membership] = await db
      .select()
      .from(agencyMemberships)
      .where(eq(agencyMemberships.id, membershipId))
    expect(membership).toMatchObject({
      agencyId,
      memberNumber: 'M-1',
      diverId: primaryDiver.id,
    })

    await saveAgencyMembership(membershipId, { memberNumber: 'M-2' })
    const [updated] = await db
      .select()
      .from(agencyMemberships)
      .where(eq(agencyMemberships.id, membershipId))
    expect(updated?.memberNumber).toBe('M-2')

    await deleteAgencyMembership(membershipId)
    expect(
      await db
        .select()
        .from(agencyMemberships)
        .where(eq(agencyMemberships.id, membershipId)),
    ).toHaveLength(0)
    await expect(deleteAgencyMembership(membershipId)).rejects.toThrow(
      'The record was not found',
    )
  })
})
