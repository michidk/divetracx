import '@tanstack/react-start/server-only'

import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export function getServerEnv() {
  return createEnv({
    server: {
      DATABASE_URL: z.url(),
      DIVEMATE_GOOGLE_DRIVE_FOLDER_ID: z.string().trim().min(1).optional(),
      DIVEMATE_MAX_BACKUP_BYTES: z.coerce
        .number()
        .int()
        .positive()
        .default(50 * 1024 * 1024),
      DIVEMATE_MAX_IMAGE_BYTES: z.coerce
        .number()
        .int()
        .positive()
        .default(100 * 1024 * 1024),
      GOOGLE_APPLICATION_CREDENTIALS: z.string().trim().min(1).optional(),
      STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
      STORAGE_PATH: z.string().trim().min(1).default('./uploads'),
      STORAGE_URL: z.string().trim().min(1).default('/media'),
      S3_BUCKET: z.string().trim().min(1).optional(),
      S3_REGION: z.string().trim().min(1).default('us-east-1'),
      S3_ENDPOINT: z.url().optional(),
      S3_ACCESS_KEY_ID: z.string().trim().min(1).optional(),
      S3_SECRET_ACCESS_KEY: z.string().trim().min(1).optional(),
    },
    runtimeEnvStrict: {
      DATABASE_URL: process.env.DATABASE_URL,
      DIVEMATE_GOOGLE_DRIVE_FOLDER_ID: process.env.DIVEMATE_GOOGLE_DRIVE_FOLDER_ID,
      DIVEMATE_MAX_BACKUP_BYTES: process.env.DIVEMATE_MAX_BACKUP_BYTES,
      DIVEMATE_MAX_IMAGE_BYTES: process.env.DIVEMATE_MAX_IMAGE_BYTES,
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
      STORAGE_PATH: process.env.STORAGE_PATH,
      STORAGE_URL: process.env.STORAGE_URL,
      S3_BUCKET: process.env.S3_BUCKET,
      S3_REGION: process.env.S3_REGION,
      S3_ENDPOINT: process.env.S3_ENDPOINT,
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    },
    emptyStringAsUndefined: true,
    isServer: true,
  })
}
