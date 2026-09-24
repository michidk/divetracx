import '@tanstack/react-start/server-only'

import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { agencyMemberships, externalRecordLinks } from '@/db/schema'
import type { EntityWrite } from '@/modules/data/field-contract'
import { validateEntityInput } from '@/modules/data/field-contract'
import {
  type AgencyMembershipInput,
  agencyMembershipContract,
} from '../credential-contracts'
import { assertAgencyExists } from './agencies.server'
import { primaryDiverId } from './diver-identity.server'

export async function saveAgencyMembership(
  id: 'new' | string,
  input: EntityWrite<AgencyMembershipInput>,
) {
  const fields = validateEntityInput(agencyMembershipContract, input, {
    mode: id === 'new' ? 'create' : 'update',
  })
  if (fields.agencyId) await assertAgencyExists(getDb(), fields.agencyId)
  const values = { ...fields, updatedAt: new Date() }
  const [row] =
    id === 'new'
      ? await getDb()
          .insert(agencyMemberships)
          .values({
            ...(values as AgencyMembershipInput & { updatedAt: Date }),
            diverId: await primaryDiverId(),
          })
          .returning({ id: agencyMemberships.id })
      : await getDb()
          .update(agencyMemberships)
          .set(values)
          .where(eq(agencyMemberships.id, id))
          .returning({ id: agencyMemberships.id })
  if (!row) throw new Error('Agency membership was not found')
  return row.id
}

export async function deleteAgencyMembership(id: string) {
  await getDb().transaction(async (transaction) => {
    await transaction
      .delete(externalRecordLinks)
      .where(
        and(
          eq(externalRecordLinks.canonicalEntityType, 'agency_membership'),
          eq(externalRecordLinks.canonicalEntityId, id),
        ),
      )
    const [row] = await transaction
      .delete(agencyMemberships)
      .where(eq(agencyMemberships.id, id))
      .returning({ id: agencyMemberships.id })
    if (!row) throw new Error('The record was not found')
  })
}
