import { createServerOnlyFn } from '@tanstack/react-start'
import type { PgliteDatabase } from 'drizzle-orm/pglite'
import * as schema from './schema'

export type Database = PgliteDatabase<typeof schema>
export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0]

let instance: Database | undefined

if (import.meta.env.SSR) {
  const [{ readFile }, { PGlite }, { drizzle }] = await Promise.all([
    import('node:fs/promises'),
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
  ])
  const snapshot = await readFile(
    new URL(/* @vite-ignore */ '../_libs/demo-db.tar.gz', import.meta.url),
  )
  const client = await PGlite.create({
    dataDir: 'memory://',
    loadDataDir: new Blob([snapshot]),
  })
  instance = drizzle(client, { schema })
}

export const getDb = createServerOnlyFn((): Database => {
  if (!instance) throw new Error('Demo database is only available on the server')
  return instance
})

export async function closeDb() {}

export async function tryAcquireDbAdvisoryLock(): Promise<() => Promise<void>> {
  return async () => {}
}
