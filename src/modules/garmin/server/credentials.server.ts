import '@tanstack/react-start/server-only'

import { eq } from 'drizzle-orm'
import { getDb } from '@/db'
import { garminAccounts } from '@/db/schema'

const ACCOUNT_ID = 'instance'

export interface GarminTokens {
  oauth1: Record<string, unknown>
  oauth2: Record<string, unknown>
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export async function loadGarminTokens(): Promise<GarminTokens | null> {
  const [account] = await getDb()
    .select({
      oauth1: garminAccounts.oauth1Token,
      oauth2: garminAccounts.oauth2Token,
    })
    .from(garminAccounts)
    .where(eq(garminAccounts.id, ACCOUNT_ID))
    .limit(1)
  const oauth1 = record(account?.oauth1)
  const oauth2 = record(account?.oauth2)
  return oauth1 && oauth2 ? { oauth1, oauth2 } : null
}

export async function loadGarminTokenStatus() {
  const [account] = await getDb()
    .select({ tokensSavedAt: garminAccounts.tokensSavedAt })
    .from(garminAccounts)
    .where(eq(garminAccounts.id, ACCOUNT_ID))
    .limit(1)
  return {
    connected: Boolean(account?.tokensSavedAt),
    tokensSavedAt: account?.tokensSavedAt ?? null,
  }
}

export async function saveGarminTokens(tokens: GarminTokens) {
  const now = new Date()
  await getDb()
    .insert(garminAccounts)
    .values({
      id: ACCOUNT_ID,
      oauth1Token: tokens.oauth1,
      oauth2Token: tokens.oauth2,
      tokensSavedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: garminAccounts.id,
      set: {
        oauth1Token: tokens.oauth1,
        oauth2Token: tokens.oauth2,
        tokensSavedAt: now,
        updatedAt: now,
      },
    })
}

export async function clearGarminTokens() {
  await getDb().delete(garminAccounts).where(eq(garminAccounts.id, ACCOUNT_ID))
}
