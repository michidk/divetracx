import '@tanstack/react-start/server-only'

import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import {
  buddyAgencyMemberships,
  buddyCertifications,
  externalRecordLinks,
} from '@/db/schema'
import type { EntityWrite } from '@/modules/data/field-contract'
import { validateEntityInput } from '@/modules/data/field-contract'
import { assertAgencyExists } from '@/modules/profile/server/agencies.server'
import {
  type BuddyAgencyMembershipInput,
  type BuddyCertificationInput,
  buddyAgencyMembershipContract,
  buddyCertificationContract,
} from '../credential-contracts'

export async function saveBuddyCertification(
  buddyId: string,
  id: 'new' | string,
  input: EntityWrite<BuddyCertificationInput>,
) {
  const fields = validateEntityInput(buddyCertificationContract, input, {
    mode: id === 'new' ? 'create' : 'update',
  })
  if (fields.agencyId) await assertAgencyExists(getDb(), fields.agencyId)
  const values = { ...fields, updatedAt: new Date() }
  const [row] =
    id === 'new'
      ? await getDb()
          .insert(buddyCertifications)
          .values({
            ...(values as BuddyCertificationInput & { updatedAt: Date }),
            buddyId,
          })
          .returning({ id: buddyCertifications.id })
      : await getDb()
          .update(buddyCertifications)
          .set(values)
          .where(eq(buddyCertifications.id, id))
          .returning({ id: buddyCertifications.id })
  if (!row) throw new Error('Buddy certification was not found')
  return row.id
}

export async function deleteBuddyCertification(id: string) {
  await getDb().transaction(async (transaction) => {
    await transaction
      .delete(externalRecordLinks)
      .where(
        and(
          eq(externalRecordLinks.canonicalEntityType, 'buddy_certification'),
          eq(externalRecordLinks.canonicalEntityId, id),
        ),
      )
    const [row] = await transaction
      .delete(buddyCertifications)
      .where(eq(buddyCertifications.id, id))
      .returning({ id: buddyCertifications.id })
    if (!row) throw new Error('The record was not found')
  })
}

export async function saveBuddyAgencyMembership(
  buddyId: string,
  id: 'new' | string,
  input: EntityWrite<BuddyAgencyMembershipInput>,
) {
  const fields = validateEntityInput(buddyAgencyMembershipContract, input, {
    mode: id === 'new' ? 'create' : 'update',
  })
  if (fields.agencyId) await assertAgencyExists(getDb(), fields.agencyId)
  const values = { ...fields, updatedAt: new Date() }
  try {
    const [row] =
      id === 'new'
        ? await getDb()
            .insert(buddyAgencyMemberships)
            .values({
              ...(values as BuddyAgencyMembershipInput & { updatedAt: Date }),
              buddyId,
            })
            .returning({ id: buddyAgencyMemberships.id })
        : await getDb()
            .update(buddyAgencyMemberships)
            .set(values)
            .where(eq(buddyAgencyMemberships.id, id))
            .returning({ id: buddyAgencyMemberships.id })
    if (!row) throw new Error('Buddy agency membership was not found')
    return row.id
  } catch (error) {
    // drizzle-orm wraps the driver's constraint-violation message as `cause`
    // rather than including it in `message`, so both must be checked.
    const messages = [
      error instanceof Error ? error.message : null,
      error instanceof Error && error.cause instanceof Error ? error.cause.message : null,
    ]
    if (
      messages.some((message) =>
        message?.includes('buddy_agency_memberships_buddy_agency_unique'),
      )
    ) {
      throw new Error('This buddy already has a number for that agency')
    }
    throw error
  }
}

export async function deleteBuddyAgencyMembership(id: string) {
  await getDb().transaction(async (transaction) => {
    await transaction
      .delete(externalRecordLinks)
      .where(
        and(
          eq(externalRecordLinks.canonicalEntityType, 'buddy_agency_membership'),
          eq(externalRecordLinks.canonicalEntityId, id),
        ),
      )
    const [row] = await transaction
      .delete(buddyAgencyMemberships)
      .where(eq(buddyAgencyMemberships.id, id))
      .returning({ id: buddyAgencyMemberships.id })
    if (!row) throw new Error('The record was not found')
  })
}
