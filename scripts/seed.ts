import type { PgliteDatabase } from 'drizzle-orm/pglite'
import { closeDb, getDb } from '@/db'
import { seedDemoDatabase } from '@/db/demo-fixtures'
import type * as schema from '@/db/schema'
import { getStorage } from '@/lib/storage'

const DEMO_ASSETS = [
  'profile-diver.webp',
  'coral-lantern-reef.webp',
  'azure-step-wall.webp',
  'north-basin-wreck.webp',
] as const

async function installDemoAssets(): Promise<void> {
  const storage = getStorage()
  for (const filename of DEMO_ASSETS) {
    const file = Bun.file(new URL(`seed-assets/demo/${filename}`, import.meta.url))
    await storage.upload(file, `demo/${filename}`)
  }
}

try {
  console.log('Seeding the canonical demo dataset...')
  await seedDemoDatabase(getDb() as unknown as PgliteDatabase<typeof schema>)
  await installDemoAssets()
  console.log('Canonical demo dataset seeded')
} finally {
  await closeDb()
}
