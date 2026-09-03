import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { InvalidStoragePathError, LocalStorageProvider } from './local'

const directories: string[] = []

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true })),
  )
})

describe('LocalStorageProvider', () => {
  test('stores and retrieves nested image objects', async () => {
    const basePath = await mkdtemp(join(tmpdir(), 'divetracx-storage-'))
    directories.push(basePath)
    const storage = new LocalStorageProvider({ basePath, baseUrl: '/media' })
    const path = 'divemate/pictures/13/image.png'

    expect(await storage.upload(new Blob(['picture'], { type: 'image/png' }), path)).toBe(
      path,
    )
    expect(await storage.exists(path)).toBe(true)
    expect(await (await storage.download(path)).text()).toBe('picture')
    expect(storage.getUrl(path)).toBe(`/media/${path}`)
  })

  test('rejects paths outside the configured root', async () => {
    const basePath = await mkdtemp(join(tmpdir(), 'divetracx-storage-'))
    directories.push(basePath)
    const storage = new LocalStorageProvider({ basePath, baseUrl: '/media' })

    await expect(storage.download('../outside.png')).rejects.toBeInstanceOf(
      InvalidStoragePathError,
    )
  })
})
