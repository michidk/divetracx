import '@tanstack/react-start/server-only'

import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export function getServerEnv() {
  return createEnv({
    server: {
      DATABASE_URL: z.url(),
      IMPORT_TIMEOUT_MS: z.coerce
        .number()
        .int()
        .positive()
        .default(15 * 60 * 1_000),
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
      SUBSURFACE_MAX_UPLOAD_BYTES: z.coerce
        .number()
        .int()
        .positive()
        .default(50 * 1024 * 1024),
      GARMIN_DOMAIN: z.enum(['garmin.com', 'garmin.cn']).default('garmin.com'),
      GARMIN_ACTIVITY_PAGE_SIZE: z.coerce.number().int().positive().max(200).default(50),
      GARMIN_FULL_IMPORT_MAX_ACTIVITIES: z.coerce
        .number()
        .int()
        .positive()
        .default(2_000),
      GARMIN_INCREMENTAL_OVERLAP_SECONDS: z.coerce
        .number()
        .int()
        .nonnegative()
        .default(3_600),
      GARMIN_MFA_CHALLENGE_TTL_SECONDS: z.coerce
        .number()
        .int()
        .positive()
        .max(900)
        .default(300),
      GARMIN_MAX_FIT_BYTES: z.coerce
        .number()
        .int()
        .positive()
        .default(25 * 1024 * 1024),
      MCP_ALLOWED_ORIGINS: z.string().trim().optional(),
      HODOR_SECRET: z.string().trim().min(1).optional(),
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
      IMPORT_TIMEOUT_MS: process.env.IMPORT_TIMEOUT_MS,
      DIVEMATE_GOOGLE_DRIVE_FOLDER_ID: process.env.DIVEMATE_GOOGLE_DRIVE_FOLDER_ID,
      DIVEMATE_MAX_BACKUP_BYTES: process.env.DIVEMATE_MAX_BACKUP_BYTES,
      DIVEMATE_MAX_IMAGE_BYTES: process.env.DIVEMATE_MAX_IMAGE_BYTES,
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      SUBSURFACE_MAX_UPLOAD_BYTES: process.env.SUBSURFACE_MAX_UPLOAD_BYTES,
      GARMIN_DOMAIN: process.env.GARMIN_DOMAIN,
      GARMIN_ACTIVITY_PAGE_SIZE: process.env.GARMIN_ACTIVITY_PAGE_SIZE,
      GARMIN_FULL_IMPORT_MAX_ACTIVITIES: process.env.GARMIN_FULL_IMPORT_MAX_ACTIVITIES,
      GARMIN_INCREMENTAL_OVERLAP_SECONDS: process.env.GARMIN_INCREMENTAL_OVERLAP_SECONDS,
      GARMIN_MFA_CHALLENGE_TTL_SECONDS: process.env.GARMIN_MFA_CHALLENGE_TTL_SECONDS,
      GARMIN_MAX_FIT_BYTES: process.env.GARMIN_MAX_FIT_BYTES,
      MCP_ALLOWED_ORIGINS: process.env.MCP_ALLOWED_ORIGINS,
      HODOR_SECRET: process.env.HODOR_SECRET,
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
