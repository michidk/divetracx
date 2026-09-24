import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { asc, eq } from 'drizzle-orm'
import { closeDb, getDb } from '@/db'
import {
  buddies,
  diveBuddies,
  diveEquipment,
  diveMerges,
  diveProfileSamples,
  dives,
  equipment,
  externalRecordLinks,
  externalRecords,
  integrations,
  pictures,
  tanks,
} from '@/db/schema'
import { MATCHED_LINK_ROLE } from '@/modules/integrations/types'
import { DiveMergeError } from '../merge'
import { mergeDivesInto } from './merge.server'

const enabled = process.env.RUN_IMPORT_INTEGRATION_TESTS === 'true'
const INTEGRATION_KEY = 'test-merge'

describe.skipIf(!enabled)('mergeDivesInto database contract', () => {
  beforeAll(async () => {
    const db = getDb()
    await db.delete(externalRecordLinks)
    await db.delete(externalRecords)
    await db.delete(integrations).where(eq(integrations.key, INTEGRATION_KEY))
    await db.delete(dives)
    await db.delete(buddies)
    await db.delete(equipment)
  })

  afterAll(async () => {
    await closeDb()
  })

  test('rejects merging a dive into itself or with no sources, before touching the database', async () => {
    await expect(
      mergeDivesInto('11111111-1111-1111-1111-111111111111', []),
    ).rejects.toThrow(DiveMergeError)
    await expect(
      mergeDivesInto('11111111-1111-1111-1111-111111111111', [
        '11111111-1111-1111-1111-111111111111',
      ]),
    ).rejects.toThrow(DiveMergeError)
  })

  test('moves tanks, remaps sample tank columns, unions buddies/equipment, moves photos, transfers merge history and provenance, and deletes the source', async () => {
    const db = getDb()

    const [keeper] = await db
      .insert(dives)
      .values({
        number: 1,
        diveDate: '2026-01-10',
        entryTime: '08:00:00',
        durationSeconds: 1800,
        notes: 'keeper',
      })
      .returning({ id: dives.id })
    const [source] = await db
      .insert(dives)
      .values({
        number: 2,
        diveDate: '2026-01-10',
        entryTime: '09:00:00',
        durationSeconds: 1200,
        notes: 'source',
      })
      .returning({ id: dives.id })
    if (!keeper || !source) throw new Error('Seed dives were not created')

    // Tanks: the keeper already uses slots 1 and 2, so the source's
    // compatible tank 1 combines while its incompatible tank 2 collides and
    // must be renumbered to slot 3 (beyond the two-slot sample chart).
    const [keeperTank1] = await db
      .insert(tanks)
      .values({
        diveId: keeper.id,
        name: 'Air',
        sortOrder: 0,
        computerTankNumber: 1,
        volumeLiters: '12.00',
        oxygenPercent: '21.00',
        endPressureBar: '50.00',
      })
      .returning({ id: tanks.id })
    const [keeperTank2] = await db
      .insert(tanks)
      .values({
        diveId: keeper.id,
        name: 'Nitrox32',
        sortOrder: 1,
        computerTankNumber: 2,
        volumeLiters: '11.00',
        oxygenPercent: '32.00',
      })
      .returning({ id: tanks.id })
    const [sourceTankCombines] = await db
      .insert(tanks)
      .values({
        diveId: source.id,
        name: 'Air',
        sortOrder: 0,
        computerTankNumber: 1,
        volumeLiters: '12.00',
        oxygenPercent: '21.00',
        endPressureBar: '30.00',
        breathingTimeSeconds: 600,
      })
      .returning({ id: tanks.id })
    const [sourceTankAppends] = await db
      .insert(tanks)
      .values({
        diveId: source.id,
        name: 'Deco50',
        sortOrder: 1,
        computerTankNumber: 2,
        volumeLiters: '7.00',
        oxygenPercent: '50.00',
      })
      .returning({ id: tanks.id })
    if (!keeperTank1 || !keeperTank2 || !sourceTankCombines || !sourceTankAppends) {
      throw new Error('Seed tanks were not created')
    }

    // Profile: the keeper's own segment 0, plus the source's segment 0 and a
    // segment 1 it already absorbed from an earlier merge.
    await db.insert(diveProfileSamples).values([
      {
        diveId: keeper.id,
        sampleIndex: 0,
        segmentIndex: 0,
        elapsedSeconds: 0,
        depthMeters: '10.00',
        tankNumber: 1,
        tank1PressureBar: '200.00',
      },
      {
        diveId: keeper.id,
        sampleIndex: 1,
        segmentIndex: 0,
        elapsedSeconds: 60,
        depthMeters: '12.00',
        tankNumber: 1,
        tank1PressureBar: '190.00',
      },
    ])
    await db.insert(diveProfileSamples).values([
      {
        diveId: source.id,
        sampleIndex: 0,
        segmentIndex: 0,
        elapsedSeconds: 0,
        depthMeters: '15.00',
        tankNumber: 1,
        tank1PressureBar: '210.00',
      },
      {
        diveId: source.id,
        sampleIndex: 1,
        segmentIndex: 0,
        elapsedSeconds: 60,
        depthMeters: '16.00',
        tankNumber: 2,
        tank2PressureBar: '180.00',
      },
      {
        diveId: source.id,
        sampleIndex: 0,
        segmentIndex: 1,
        elapsedSeconds: 0,
        depthMeters: '18.00',
        tankNumber: 1,
        tank1PressureBar: '150.00',
      },
    ])

    // The source already absorbed an earlier, now-deleted dive.
    const priorAbsorbedId = crypto.randomUUID()
    await db.insert(diveMerges).values({
      targetDiveId: source.id,
      segmentIndex: 1,
      offsetSeconds: 5_000,
      sourceDiveId: priorAbsorbedId,
      sourceLabel: 'Earlier absorbed dive',
    })

    // Buddies: a role conflict on a shared buddy, plus one unique to the source.
    const [sharedBuddy] = await db
      .insert(buddies)
      .values({ firstName: 'Shared' })
      .returning({ id: buddies.id })
    const [sourceOnlyBuddy] = await db
      .insert(buddies)
      .values({ firstName: 'SourceOnly' })
      .returning({ id: buddies.id })
    if (!sharedBuddy || !sourceOnlyBuddy) throw new Error('Seed buddies were not created')
    await db.insert(diveBuddies).values([
      { diveId: keeper.id, buddyId: sharedBuddy.id, role: 'buddy' },
      { diveId: source.id, buddyId: sharedBuddy.id, role: 'instructor' },
      { diveId: source.id, buddyId: sourceOnlyBuddy.id, role: 'guide' },
    ])

    // Equipment: an item both dives list, plus one unique to the source.
    const [sharedGear] = await db
      .insert(equipment)
      .values({ name: 'Shared BCD' })
      .returning({ id: equipment.id })
    const [sourceOnlyGear] = await db
      .insert(equipment)
      .values({ name: 'Source-only fins' })
      .returning({ id: equipment.id })
    if (!sharedGear || !sourceOnlyGear) throw new Error('Seed equipment was not created')
    await db.insert(diveEquipment).values([
      { diveId: keeper.id, equipmentId: sharedGear.id },
      { diveId: source.id, equipmentId: sharedGear.id },
      { diveId: source.id, equipmentId: sourceOnlyGear.id },
    ])

    // Ordered pictures on both dives.
    await db.insert(pictures).values([
      { diveId: keeper.id, path: 'keeper-0.jpg', sortOrder: 0 },
      { diveId: source.id, path: 'source-0.jpg', sortOrder: 0 },
      { diveId: source.id, path: 'source-1.jpg', sortOrder: 1 },
    ])

    // External provenance pointing at the source dive.
    await db.insert(integrations).values({
      key: INTEGRATION_KEY,
      displayName: 'Test merge integration',
      capabilities: { fullImport: true, incrementalImport: true, export: false },
      supportedEntities: ['dives'],
    })
    const [externalRecord] = await db
      .insert(externalRecords)
      .values({
        integrationKey: INTEGRATION_KEY,
        entityType: 'activity',
        identityKey: 'source-activity',
        rawPayload: {},
        contentHash: 'hash-1',
      })
      .returning({ id: externalRecords.id })
    if (!externalRecord) throw new Error('Seed external record was not created')
    await db.insert(externalRecordLinks).values({
      externalRecordId: externalRecord.id,
      canonicalEntityType: 'dive',
      canonicalEntityId: source.id,
      role: 'produced',
    })

    const result = await mergeDivesInto(keeper.id, [source.id])
    expect(result).toEqual({ diveId: keeper.id, mergedCount: 1 })

    // The source dive is gone; the keeper survives under its own id and number.
    const remainingDives = await db
      .select({ id: dives.id, number: dives.number })
      .from(dives)
    expect(remainingDives).toEqual([{ id: keeper.id, number: 1 }])

    // Tanks: the combined tank keeps the keeper's row and picks up the
    // source's end pressure and breathing time; the incompatible tank is
    // appended under the keeper and renumbered past the collision.
    const finalTanks = await db
      .select({
        id: tanks.id,
        diveId: tanks.diveId,
        computerTankNumber: tanks.computerTankNumber,
        endPressureBar: tanks.endPressureBar,
        breathingTimeSeconds: tanks.breathingTimeSeconds,
      })
      .from(tanks)
      .where(eq(tanks.diveId, keeper.id))
      .orderBy(asc(tanks.sortOrder))
    expect(finalTanks.every((tank) => tank.diveId === keeper.id)).toBe(true)
    expect(finalTanks.map((tank) => tank.id).sort()).toEqual(
      [keeperTank1.id, keeperTank2.id, sourceTankAppends.id].sort(),
    )
    expect(finalTanks.some((tank) => tank.id === sourceTankCombines.id)).toBe(false)
    const combinedTank = finalTanks.find((tank) => tank.id === keeperTank1.id)
    expect(combinedTank?.endPressureBar).toBe('30.00')
    expect(combinedTank?.breathingTimeSeconds).toBe(600)
    const appendedTank = finalTanks.find((tank) => tank.id === sourceTankAppends.id)
    expect(appendedTank?.computerTankNumber).toBe(3)

    // Profile: every sample now belongs to the keeper, resequenced without
    // gaps, with fresh consecutive segment indexes for both of the source's
    // segments — its own, plus the one it inherited from an earlier merge —
    // and its tank-2 readings remapped to the appended tank's new number,
    // leaving no reading behind under the vacated tank-2 slot.
    const finalSamples = await db
      .select({
        diveId: diveProfileSamples.diveId,
        sampleIndex: diveProfileSamples.sampleIndex,
        segmentIndex: diveProfileSamples.segmentIndex,
        tankNumber: diveProfileSamples.tankNumber,
        tank1PressureBar: diveProfileSamples.tank1PressureBar,
        tank2PressureBar: diveProfileSamples.tank2PressureBar,
      })
      .from(diveProfileSamples)
      .where(eq(diveProfileSamples.diveId, keeper.id))
      .orderBy(asc(diveProfileSamples.sampleIndex))
    expect(finalSamples).toHaveLength(5)
    expect(finalSamples.every((sample) => sample.diveId === keeper.id)).toBe(true)
    expect(finalSamples.map((sample) => sample.sampleIndex)).toEqual([0, 1, 2, 3, 4])
    expect(new Set(finalSamples.map((sample) => sample.segmentIndex))).toEqual(
      new Set([0, 1, 2]),
    )
    const renumberedSample = finalSamples.find((sample) => sample.tankNumber === 3)
    expect(renumberedSample?.segmentIndex).not.toBe(0)
    expect(renumberedSample?.tank2PressureBar).toBeNull()
    expect(finalSamples.some((sample) => sample.tankNumber === 2)).toBe(false)

    // Buddies: the keeper's role for the shared buddy wins over the source's,
    // and the source-only buddy is unioned in.
    const finalBuddies = await db
      .select({ buddyId: diveBuddies.buddyId, role: diveBuddies.role })
      .from(diveBuddies)
      .where(eq(diveBuddies.diveId, keeper.id))
    const byBuddy = (rows: typeof finalBuddies) =>
      [...rows].sort((a, b) => a.buddyId.localeCompare(b.buddyId))
    expect(byBuddy(finalBuddies)).toEqual(
      byBuddy([
        { buddyId: sharedBuddy.id, role: 'buddy' },
        { buddyId: sourceOnlyBuddy.id, role: 'guide' },
      ]),
    )

    // Equipment: unioned without duplicating the shared item.
    const finalEquipment = await db
      .select({ equipmentId: diveEquipment.equipmentId })
      .from(diveEquipment)
      .where(eq(diveEquipment.diveId, keeper.id))
    expect(finalEquipment.map((row) => row.equipmentId).sort()).toEqual(
      [sharedGear.id, sourceOnlyGear.id].sort(),
    )

    // Pictures: all moved to the keeper, ordered after the keeper's own.
    const finalPictures = await db
      .select({
        path: pictures.path,
        sortOrder: pictures.sortOrder,
        diveId: pictures.diveId,
      })
      .from(pictures)
      .where(eq(pictures.diveId, keeper.id))
      .orderBy(asc(pictures.sortOrder))
    expect(finalPictures.every((picture) => picture.diveId === keeper.id)).toBe(true)
    expect(finalPictures.map((picture) => picture.path)).toEqual([
      'keeper-0.jpg',
      'source-0.jpg',
      'source-1.jpg',
    ])
    expect(finalPictures.map((picture) => picture.sortOrder)).toEqual([0, 1, 2])

    // Merge history: the source's own absorption is recorded, and the merge
    // it had already absorbed now points at the keeper too.
    const finalMerges = await db
      .select({
        targetDiveId: diveMerges.targetDiveId,
        sourceDiveId: diveMerges.sourceDiveId,
      })
      .from(diveMerges)
    expect(finalMerges.every((row) => row.targetDiveId === keeper.id)).toBe(true)
    expect(finalMerges.map((row) => row.sourceDiveId).sort()).toEqual(
      [source.id, priorAbsorbedId].sort(),
    )

    // Provenance: the source's external record now points at the keeper as
    // matched rather than owned, and the old link pointing at the source is gone.
    const finalLinks = await db
      .select({
        canonicalEntityId: externalRecordLinks.canonicalEntityId,
        role: externalRecordLinks.role,
      })
      .from(externalRecordLinks)
      .where(eq(externalRecordLinks.externalRecordId, externalRecord.id))
    expect(finalLinks).toEqual([
      { canonicalEntityId: keeper.id, role: MATCHED_LINK_ROLE },
    ])
  })
})
