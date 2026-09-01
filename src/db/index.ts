import '@tanstack/react-start/server-only'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { getServerEnv } from '@/env'
import * as schema from './schema'

export type Database = ReturnType<typeof drizzle<typeof schema>>
export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0]
type PostgresClient = ReturnType<typeof postgres>

let instance: Database | undefined
let client: PostgresClient | undefined

export function getDb(): Database {
  if (instance) return instance

  client = postgres(getServerEnv().DATABASE_URL, {
    max: 10,
    prepare: false,
  })
  instance = drizzle(client, { schema })
  return instance
}

export async function closeDb() {
  await client?.end({ timeout: 5 })
  client = undefined
  instance = undefined
}
