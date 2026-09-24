import '@tanstack/react-start/server-only'

import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { diveSites, externalRecordLinks } from '@/db/schema'
import type { EntityWrite } from '@/modules/data/field-contract'
import { validateEntityInput } from '@/modules/data/field-contract'
import { type SiteInput, siteContract } from '../entity-contract'

export async function saveSite(id: 'new' | string, input: EntityWrite<SiteInput>) {
  const fields = validateEntityInput(siteContract, input, {
    mode: id === 'new' ? 'create' : 'update',
  })
  const values = { ...fields, updatedAt: new Date() }
  const [row] =
    id === 'new'
      ? // Runtime validation above guarantees every required field is present
        // when mode is 'create'; the partial type cannot express that.
        await getDb()
          .insert(diveSites)
          .values(values as SiteInput & { updatedAt: Date })
          .returning({ id: diveSites.id })
      : await getDb()
          .update(diveSites)
          .set(values)
          .where(eq(diveSites.id, id))
          .returning({ id: diveSites.id })
  if (!row) throw new Error('Dive site was not found')
  return row.id
}

export async function deleteSite(id: string) {
  await getDb().transaction(async (transaction) => {
    await transaction
      .delete(externalRecordLinks)
      .where(
        and(
          eq(externalRecordLinks.canonicalEntityType, 'dive_site'),
          eq(externalRecordLinks.canonicalEntityId, id),
        ),
      )
    const [row] = await transaction
      .delete(diveSites)
      .where(eq(diveSites.id, id))
      .returning({ id: diveSites.id })
    if (!row) throw new Error('The record was not found')
  })
}
