import '@tanstack/react-start/server-only'

import { existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const TOKEN_FILES = ['oauth1_token.json', 'oauth2_token.json'] as const

export function hasStoredTokens(tokenDirectory: string) {
  return TOKEN_FILES.every((file) => existsSync(join(tokenDirectory, file)))
}

export function storedTokensSavedAt(tokenDirectory: string): Date | null {
  const path = join(tokenDirectory, TOKEN_FILES[0])
  if (!existsSync(path)) return null
  return statSync(path).mtime
}

export function ensureTokenDirectory(tokenDirectory: string) {
  mkdirSync(tokenDirectory, { recursive: true })
}

export function clearStoredTokens(tokenDirectory: string) {
  for (const file of TOKEN_FILES) {
    rmSync(join(tokenDirectory, file), { force: true })
  }
}
