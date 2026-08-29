import { resolve } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL?.trim()
if (!databaseUrl) throw new Error('DATABASE_URL is required')

const client = postgres(databaseUrl, { max: 1, prepare: false })
try {
  await migrate(drizzle(client), {
    migrationsFolder: resolve(import.meta.dir, '../drizzle'),
  })
  console.log('Database migrations completed')
} finally {
  await client.end({ timeout: 5 })
}
