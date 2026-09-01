import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseDiveMateDatabase } from '@/modules/divemate/parser'
import { loadExportSnapshot } from '@/modules/export/server/snapshot.server'
import { openGoogleDriveBackup } from './google-drive.server'
import { openSqlite, type SqliteDatabase } from './sqlite.server'
import { writeBackDiveMate } from './writeback.server'

const enabled = process.env.RUN_DIVEMATE_INTEGRATION_TESTS === 'true'

function schema(database: SqliteDatabase) {
  const tables = database
    .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all() as Array<{ name: string; sql: string }>
  return tables.map((table) => ({
    ...table,
    columns: database.prepare(`PRAGMA table_info("${table.name}")`).all(),
    indexes: database.prepare(`PRAGMA index_list("${table.name}")`).all(),
  }))
}

describe.skipIf(!enabled)('DiveMate export integration', () => {
  let directory = ''
  let exportPath = ''
  let drivePath = ''

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'divetracx-export-test-'))
    exportPath = join(directory, 'export.ddb')
    drivePath = join(directory, 'drive.ddb')
  })

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  test('preserves the DiveMate schema and round-trips current records and coordinates', async () => {
    const folderId = process.env.DIVEMATE_GOOGLE_DRIVE_FOLDER_ID
    if (!folderId) throw new Error('DIVEMATE_GOOGLE_DRIVE_FOLDER_ID is required')
    const maximumBytes = Number(process.env.DIVEMATE_MAX_BACKUP_BYTES ?? 100_000_000)
    const drive = await openGoogleDriveBackup(folderId, maximumBytes)
    await writeFile(drivePath, drive.database)
    const result = await writeBackDiveMate({ upload: false, outputPath: exportPath })
    expect(result.updatedRecords).toBeGreaterThan(0)

    const [driveDatabase, exportDatabase] = await Promise.all([
      openSqlite(drivePath, { readonly: true }),
      openSqlite(exportPath, { readonly: true }),
    ])
    try {
      expect(schema(exportDatabase)).toEqual(schema(driveDatabase))
    } finally {
      driveDatabase.close()
      exportDatabase.close()
    }

    const [exported, current] = await Promise.all([
      parseDiveMateDatabase(exportPath),
      loadExportSnapshot(),
    ])
    expect({
      divers: exported.divers.length,
      sites: exported.sites.length,
      buddies: exported.buddies.length,
      equipment: exported.equipment.length,
      certifications: exported.certifications.length,
      shops: exported.shops.length,
      diveTypes: exported.diveTypes.length,
      dives: exported.dives.length,
      tanks: exported.tanks.length,
      pictures: exported.pictures.length,
    }).toEqual({
      divers: current.data.divers.length,
      sites: current.data.diveSites.length,
      buddies: current.data.buddies.length,
      equipment: current.data.equipment.length,
      certifications: current.data.certifications.length,
      shops: current.data.shops.length,
      diveTypes: current.data.diveTypes.length,
      dives: current.data.dives.length,
      tanks: current.data.tanks.length,
      pictures: current.data.pictures.length,
    })

    const sitesByExternalId = new Map(
      exported.sites.map((site) => [site.externalId, site]),
    )
    for (const site of current.data.diveSites) {
      const exportedSite = [...sitesByExternalId.values()].find(
        (candidate) => candidate.externalUuid === site.id,
      )
      expect(exportedSite, `missing site ${site.id}`).toBeDefined()
      expect(Number(exportedSite?.latitude)).toBeCloseTo(Number(site.latitude), 5)
      expect(Number(exportedSite?.longitude)).toBeCloseTo(Number(site.longitude), 5)
    }
  }, 120_000)
})
