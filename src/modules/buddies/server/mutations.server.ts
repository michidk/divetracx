import '@tanstack/react-start/server-only'

import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { buddies, externalRecordLinks } from '@/db/schema'
import type { EntityWrite } from '@/modules/data/field-contract'
import { validateEntityInput } from '@/modules/data/field-contract'
import { type BuddyInput, buddyContract } from '../entity-contract'

export async function saveBuddy(id: 'new' | string, input: EntityWrite<BuddyInput>) {
  const fields = validateEntityInput(buddyContract, input, {
    mode: id === 'new' ? 'create' : 'update',
  })
  const values = { ...fields, updatedAt: new Date() }
  const [row] =
    id === 'new'
      ? await getDb()
          .insert(buddies)
          .values(values as BuddyInput & { updatedAt: Date })
          .returning({ id: buddies.id })
      : await getDb()
          .update(buddies)
          .set(values)
          .where(eq(buddies.id, id))
          .returning({ id: buddies.id })
  if (!row) throw new Error('Buddy was not found')
  return row.id
}

export async function deleteBuddy(id: string) {
  await getDb().transaction(async (transaction) => {
    await transaction
      .delete(externalRecordLinks)
      .where(
        and(
          eq(externalRecordLinks.canonicalEntityType, 'buddy'),
          eq(externalRecordLinks.canonicalEntityId, id),
        ),
      )
    const [row] = await transaction
      .delete(buddies)
      .where(eq(buddies.id, id))
      .returning({ id: buddies.id })
    if (!row) throw new Error('The record was not found')
  })
}
