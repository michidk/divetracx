import '@tanstack/react-start/server-only'

import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/db'
import {
  equipment,
  equipmentSetItems,
  equipmentSets,
  externalRecordLinks,
} from '@/db/schema'
import type { EntityWrite } from '@/modules/data/field-contract'
import { validateEntityInput } from '@/modules/data/field-contract'
import { primaryDiverId } from '@/modules/profile/server/diver-identity.server'
import { type EquipmentInput, equipmentContract } from '../entity-contract'

export async function saveEquipment(
  id: 'new' | string,
  input: EntityWrite<EquipmentInput>,
) {
  const fields = validateEntityInput(equipmentContract, input, {
    mode: id === 'new' ? 'create' : 'update',
  })
  const values = { ...fields, updatedAt: new Date() }
  const [row] =
    id === 'new'
      ? await getDb()
          .insert(equipment)
          .values({
            ...(values as EquipmentInput & { updatedAt: Date }),
            diverId: await primaryDiverId(),
          })
          .returning({ id: equipment.id })
      : await getDb()
          .update(equipment)
          .set(values)
          .where(eq(equipment.id, id))
          .returning({ id: equipment.id })
  if (!row) throw new Error('Gear item was not found')
  return row.id
}

export async function deleteEquipment(id: string) {
  await getDb().transaction(async (transaction) => {
    await transaction
      .delete(externalRecordLinks)
      .where(
        and(
          eq(externalRecordLinks.canonicalEntityType, 'equipment'),
          eq(externalRecordLinks.canonicalEntityId, id),
        ),
      )
    const [row] = await transaction
      .delete(equipment)
      .where(eq(equipment.id, id))
      .returning({ id: equipment.id })
    if (!row) throw new Error('The record was not found')
  })
}

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
