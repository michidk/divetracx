import '@tanstack/react-start/server-only'

import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/db'
import { equipmentSetItems, equipmentSets, externalRecordLinks } from '@/db/schema'

export const gearSetInputSchema = z.object({
  id: z.union([z.literal('new'), z.string().uuid()]),
  name: z.string().trim().min(1, 'Name is required').max(200),
  notes: z.string().trim().max(10_000),
  inactive: z.boolean(),
  equipmentIds: z.array(z.string().uuid()),
})

export async function saveGearSet(input: z.infer<typeof gearSetInputSchema>) {
  const values = {
    name: input.name,
    notes: input.notes || null,
    inactive: input.inactive,
    updatedAt: new Date(),
  }
  return getDb().transaction(async (transaction) => {
    const [row] =
      input.id === 'new'
        ? await transaction
            .insert(equipmentSets)
            .values(values)
            .returning({ id: equipmentSets.id })
        : await transaction
            .update(equipmentSets)
            .set(values)
            .where(eq(equipmentSets.id, input.id))
            .returning({ id: equipmentSets.id })
    if (!row) throw new Error('Gear set was not found')

    await transaction
      .delete(equipmentSetItems)
      .where(eq(equipmentSetItems.equipmentSetId, row.id))
    const equipmentIds = [...new Set(input.equipmentIds)]
    if (equipmentIds.length > 0) {
      await transaction.insert(equipmentSetItems).values(
        equipmentIds.map((equipmentId, sortOrder) => ({
          equipmentSetId: row.id,
          equipmentId,
          sortOrder,
        })),
      )
    }
    return row
  })
}

export async function deleteGearSet(id: string) {
  const gearSetId = z.string().uuid().parse(id)
  await getDb().transaction(async (transaction) => {
    await transaction
      .delete(externalRecordLinks)
      .where(
        and(
          eq(externalRecordLinks.canonicalEntityType, 'equipment_set'),
          eq(externalRecordLinks.canonicalEntityId, gearSetId),
        ),
      )
    const [row] = await transaction
      .delete(equipmentSets)
      .where(eq(equipmentSets.id, gearSetId))
      .returning({ id: equipmentSets.id })
    if (!row) throw new Error('Gear set was not found')
  })
}
