import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import type { StorageConfig, StorageProvider } from './types'

export class InvalidStoragePathError extends Error {}

function assertSafeStoragePath(path: string) {
  let decoded = path
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) decoded = decodeURIComponent(decoded)
  } catch {
    throw new InvalidStoragePathError()
  }
  const candidates = [path, decoded]
  if (
    !path ||
    path.includes('\0') ||
    candidates.some((value) => isAbsolute(value) || /^[a-zA-Z]:[\\/]/.test(value)) ||
    candidates.some((value) => value.replaceAll('\\', '/').split('/').includes('..'))
  ) {
    throw new InvalidStoragePathError()
  }
}

export class LocalStorageProvider implements StorageProvider {
  private readonly basePath: string
  private readonly baseUrl: string

  constructor(config: NonNullable<StorageConfig['local']>) {
    this.basePath = resolve(config.basePath)
    this.baseUrl = config.baseUrl
  }

  private resolvePath(path: string) {
    assertSafeStoragePath(path)
    const fullPath = resolve(this.basePath, path)
    const relativePath = relative(this.basePath, fullPath)
    if (
      !relativePath ||
      relativePath === '..' ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      throw new InvalidStoragePathError()
    }
    return fullPath
  }

  async upload(file: File | Blob, path: string) {
    const fullPath = this.resolvePath(path)
    await mkdir(dirname(fullPath), { recursive: true })
    await writeFile(fullPath, Buffer.from(await file.arrayBuffer()))
    return path
  }

  async download(path: string) {
    return new Blob([await readFile(this.resolvePath(path))])
  }

  async delete(path: string) {
    await unlink(this.resolvePath(path))
  }

  getUrl(path: string) {
    return `${this.baseUrl.replace(/\/$/, '')}/${path}`
  }

  async exists(path: string) {
    try {
      await stat(this.resolvePath(path))
      return true
    } catch {
      return false
    }
  }
}
