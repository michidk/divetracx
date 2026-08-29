import '@tanstack/react-start/server-only'

import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export function getServerEnv() {
  return createEnv({
    server: {
      DATABASE_URL: z.url(),
      DIVEMATE_BACKUP_URL: z.url().optional(),
      DIVEMATE_MAX_BACKUP_BYTES: z.coerce
        .number()
        .int()
        .positive()
        .default(50 * 1024 * 1024),
    },
    runtimeEnvStrict: {
      DATABASE_URL: process.env.DATABASE_URL,
      DIVEMATE_BACKUP_URL: process.env.DIVEMATE_BACKUP_URL,
      DIVEMATE_MAX_BACKUP_BYTES: process.env.DIVEMATE_MAX_BACKUP_BYTES,
    },
    emptyStringAsUndefined: true,
    isServer: true,
  })
}
