import '@tanstack/react-start/server-only'

import { basename } from 'node:path'
import { GoogleAuth } from 'google-auth-library'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'
const DRIVE_REQUEST_TIMEOUT_MS = 60_000
const DRIVE_UPLOAD_TIMEOUT_MS = 120_000

export interface GoogleDriveFile {
  id: string
  name: string
  mimeType: string
  path: string
  size: number | null
}

export interface GoogleDriveBackup {
  database: Uint8Array
  databaseFile: GoogleDriveFile
  files: GoogleDriveFile[]
  download(file: GoogleDriveFile, maximumBytes?: number): Promise<Uint8Array>
  replaceDatabase(bytes: Uint8Array): Promise<void>
}

interface DriveListResponse {
  files?: Array<{
    id?: string
    name?: string
    mimeType?: string
    size?: string
  }>
  nextPageToken?: string
}

function escapeDriveQuery(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")
}

function byteArray(value: unknown): Uint8Array {
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  throw new Error('Google Drive returned an unexpected binary response')
}

export function drivePathBasename(path: string | null): string | null {
  if (!path) return null
  const normalized = path.replaceAll('\\', '/')
  const name = basename(normalized).trim()
  return name || null
}

export function findDriveFile(
  files: GoogleDriveFile[],
  originalPath: string | null,
  preferredFolder?: 'Media',
): GoogleDriveFile | null {
  const wanted = drivePathBasename(originalPath)?.toLocaleLowerCase()
  if (!wanted) return null
  const matches = files.filter((file) => file.name.toLocaleLowerCase() === wanted)
  if (matches.length === 0) return null
  return (
    matches.sort((left, right) => {
      if (preferredFolder) {
        const leftPreferred = left.path
          .toLocaleLowerCase()
          .includes(`/${preferredFolder.toLocaleLowerCase()}/`)
        const rightPreferred = right.path
          .toLocaleLowerCase()
          .includes(`/${preferredFolder.toLocaleLowerCase()}/`)
        if (leftPreferred !== rightPreferred) return leftPreferred ? -1 : 1
      }
      return left.path.localeCompare(right.path)
    })[0] ?? null
  )
}

export async function openGoogleDriveBackup(
  rootFolderId: string,
  maximumDatabaseBytes: number,
): Promise<GoogleDriveBackup> {
  const auth = new GoogleAuth({ scopes: [DRIVE_SCOPE] })
  const client = await auth.getClient()
  const files: GoogleDriveFile[] = []

  async function listFolder(folderId: string, folderPath: string): Promise<void> {
    let pageToken: string | undefined
    do {
      const response = await client.request<DriveListResponse>({
        url: `${DRIVE_API}/files`,
        params: {
          q: `'${escapeDriveQuery(folderId)}' in parents and trashed = false`,
          fields: 'nextPageToken,files(id,name,mimeType,size)',
          pageSize: 1000,
          pageToken,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        },
        signal: AbortSignal.timeout(DRIVE_REQUEST_TIMEOUT_MS),
      })
      for (const entry of response.data.files ?? []) {
        if (!entry.id || !entry.name || !entry.mimeType) continue
        const path = `${folderPath}/${entry.name}`
        if (entry.mimeType === FOLDER_MIME_TYPE) {
          await listFolder(entry.id, path)
        } else {
          files.push({
            id: entry.id,
            name: entry.name,
            mimeType: entry.mimeType,
            path,
            size: entry.size ? Number(entry.size) : null,
          })
        }
      }
      pageToken = response.data.nextPageToken
    } while (pageToken)
  }

  await listFolder(rootFolderId, '')
  const databaseFile = files.find(
    (file) => file.name.toLocaleLowerCase() === 'divemate.ddb',
  )
  if (!databaseFile) {
    throw new Error('The Google Drive folder does not contain DiveMate.ddb')
  }
  const selectedDatabaseFile = databaseFile

  async function download(file: GoogleDriveFile, maximumBytes?: number) {
    if (maximumBytes && file.size && file.size > maximumBytes) {
      throw new Error(`${file.path} exceeds the ${maximumBytes} byte limit`)
    }
    const response = await client.request<ArrayBuffer>({
      url: `${DRIVE_API}/files/${encodeURIComponent(file.id)}`,
      params: { alt: 'media', supportsAllDrives: true },
      responseType: 'arraybuffer',
      signal: AbortSignal.timeout(DRIVE_REQUEST_TIMEOUT_MS),
    })
    const bytes = byteArray(response.data)
    if (maximumBytes && bytes.byteLength > maximumBytes) {
      throw new Error(`${file.path} exceeds the ${maximumBytes} byte limit`)
    }
    return bytes
  }

  const database = await download(selectedDatabaseFile, maximumDatabaseBytes)
  if (new TextDecoder().decode(database.slice(0, 16)) !== 'SQLite format 3\0') {
    throw new Error('DiveMate.ddb in Google Drive is not a SQLite 3 database')
  }
  async function replaceDatabase(bytes: Uint8Array) {
    await client.request({
      url: `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(selectedDatabaseFile.id)}`,
      method: 'PATCH',
      params: { uploadType: 'media', keepRevisionForever: true, supportsAllDrives: true },
      headers: { 'content-type': 'application/octet-stream' },
      data: Uint8Array.from(bytes),
      signal: AbortSignal.timeout(DRIVE_UPLOAD_TIMEOUT_MS),
    })
  }
  return {
    database,
    databaseFile: selectedDatabaseFile,
    files,
    download,
    replaceDatabase,
  }
}
