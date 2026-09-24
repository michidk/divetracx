import '@tanstack/react-start/server-only'

import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { divers } from '@/db/schema'
import type { EntityWrite } from '@/modules/data/field-contract'
import { validateEntityInput } from '@/modules/data/field-contract'
import { type DiverInput, diverContract } from '../entity-contract'

export async function saveDiver(id: 'new' | string, input: EntityWrite<DiverInput>) {
  const fields = validateEntityInput(diverContract, input, {
    mode: id === 'new' ? 'create' : 'update',
  })
  const values = { ...fields, updatedAt: new Date() }
  const [row] =
    id === 'new'
      ? await getDb().insert(divers).values(values).returning({ id: divers.id })
      : await getDb()
          .update(divers)
          .set(values)
          .where(eq(divers.id, id))
          .returning({ id: divers.id })
  if (!row) throw new Error('Diver was not found')
  return row.id
}
