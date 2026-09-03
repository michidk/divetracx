import '@tanstack/react-start/server-only'

import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getServerEnv } from '@/env'
import { loadExportSnapshot } from '@/modules/export/server/snapshot.server'
import { rewriteDiveMateDatabase } from './exporter.server'
import { openGoogleDriveBackup } from './google-drive.server'
import { openSqlite } from './sqlite.server'

export interface DiveMateWriteBackResult {
  updatedRecords: number
  skippedLocalRecords: 0
  driveFileId: string
}

interface DiveMateWriteBackOptions {
  upload?: boolean
  outputPath?: string
}

export interface DiveMateExportFile {
  bytes: Uint8Array
  fileName: string
  contentType: string
  recordsExported: number
  templateDriveFileId: string
}

export type DiveMateWriteBackStage =
  | 'reading-drive'
  | 'reading-divetracx'
  | 'updating-database'
  | 'uploading-drive'

export interface DiveMateWriteBackStatus {
  id: string
  state: 'running' | 'succeeded' | 'failed'
  stage: DiveMateWriteBackStage
  startedAt: string
  finishedAt: string | null
  result: DiveMateWriteBackResult | null
  error: string | null
}

const writeBackState = globalThis as typeof globalThis & {
  __divetracxWriteBack?: DiveMateWriteBackStatus
}

function setStage(stage: DiveMateWriteBackStage) {
  if (writeBackState.__divetracxWriteBack?.state === 'running')
    writeBackState.__divetracxWriteBack.stage = stage
}

export async function writeBackDiveMate(
  options: DiveMateWriteBackOptions = {},
): Promise<DiveMateWriteBackResult> {
  const { file, replaceDatabase } = await createDiveMateExportFile()
  const bytes = file.bytes
  if (options.outputPath) {
    await mkdir(join(options.outputPath, '..'), { recursive: true })
    await writeFile(options.outputPath, bytes)
  }
  if (options.upload !== false) {
    setStage('uploading-drive')
    await replaceDatabase(bytes)
  }
  return {
    updatedRecords: file.recordsExported,
    skippedLocalRecords: 0,
    driveFileId: file.templateDriveFileId,
  }
}

async function createDiveMateExportFile() {
  const environment = getServerEnv()
  if (!environment.DIVEMATE_GOOGLE_DRIVE_FOLDER_ID) {
    throw new Error('DIVEMATE_GOOGLE_DRIVE_FOLDER_ID is not configured')
  }
  setStage('reading-drive')
  const drivePromise = openGoogleDriveBackup(
    environment.DIVEMATE_GOOGLE_DRIVE_FOLDER_ID,
    environment.DIVEMATE_MAX_BACKUP_BYTES,
  )
  setStage('reading-divetracx')
  const [drive, snapshot] = await Promise.all([drivePromise, loadExportSnapshot()])
  const directory = await mkdtemp(join(tmpdir(), 'divetracx-divemate-export-'))
  const path = join(directory, 'DiveMate.ddb')
  try {
    await writeFile(path, drive.database)
    setStage('updating-database')
    const database = await openSqlite(path)
    try {
      rewriteDiveMateDatabase(database, snapshot)
      database.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    } finally {
      database.close()
    }
    const bytes = new Uint8Array(await readFile(path))
    const recordsExported = [
      snapshot.data.divers,
      snapshot.data.diveSites,
      snapshot.data.buddies,
      snapshot.data.buddyCertifications,
      snapshot.data.buddyAgencyMemberships,
      snapshot.data.equipment,
      snapshot.data.certifications,
      snapshot.data.shops,
      snapshot.data.diveTypes,
      snapshot.data.dives,
      snapshot.data.tanks,
      snapshot.data.pictures,
    ].reduce((total, rows) => total + rows.length, 0)
    return {
      file: {
        bytes,
        fileName: `divetracx-divemate-${new Date().toISOString().slice(0, 10)}.ddb`,
        contentType: 'application/vnd.sqlite3',
        recordsExported,
        templateDriveFileId: drive.databaseFile.id,
      } satisfies DiveMateExportFile,
      replaceDatabase: drive.replaceDatabase,
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

export async function exportDiveMateBackup(): Promise<DiveMateExportFile> {
  return (await createDiveMateExportFile()).file
}

export function startDiveMateWriteBack(): DiveMateWriteBackStatus {
  const current = writeBackState.__divetracxWriteBack
  if (current?.state === 'running') return current
  const status: DiveMateWriteBackStatus = {
    id: randomUUID(),
    state: 'running',
    stage: 'reading-drive',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    result: null,
    error: null,
  }
  writeBackState.__divetracxWriteBack = status
  void writeBackDiveMate().then(
    (result) => {
      status.state = 'succeeded'
      status.result = result
      status.finishedAt = new Date().toISOString()
    },
    (error) => {
      status.state = 'failed'
      status.error = error instanceof Error ? error.message : 'Drive write-back failed'
      status.finishedAt = new Date().toISOString()
    },
  )
  return status
}

export function getDiveMateWriteBackStatus(): DiveMateWriteBackStatus | null {
  return writeBackState.__divetracxWriteBack ?? null
}
