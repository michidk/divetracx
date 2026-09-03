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
      GARMIN_ADAPTER_FULL_IMPORT_URL: z.url().optional(),
      GARMIN_ADAPTER_INCREMENTAL_IMPORT_URL: z.url().optional(),
      GARMIN_ADAPTER_AUTHORIZATION: z.string().trim().min(1).optional(),
      GARMIN_ADAPTER_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
      GARMIN_ADAPTER_MAX_RESPONSE_BYTES: z.coerce
        .number()
        .int()
        .positive()
        .default(100 * 1024 * 1024),
      GARMIN_MAX_FIT_BYTES: z.coerce
        .number()
        .int()
        .positive()
        .default(25 * 1024 * 1024),
      MCP_SERVER_URL: z.url().optional(),
      MCP_OAUTH_ISSUER: z.url().optional(),
      MCP_OAUTH_AUDIENCE: z.string().trim().min(1).optional(),
      MCP_OAUTH_SCOPE: z.string().trim().min(1).default('divetracx:read'),
      MCP_ALLOWED_ORIGINS: z.string().trim().optional(),
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
      GARMIN_ADAPTER_FULL_IMPORT_URL: process.env.GARMIN_ADAPTER_FULL_IMPORT_URL,
      GARMIN_ADAPTER_INCREMENTAL_IMPORT_URL:
        process.env.GARMIN_ADAPTER_INCREMENTAL_IMPORT_URL,
      GARMIN_ADAPTER_AUTHORIZATION: process.env.GARMIN_ADAPTER_AUTHORIZATION,
      GARMIN_ADAPTER_TIMEOUT_MS: process.env.GARMIN_ADAPTER_TIMEOUT_MS,
      GARMIN_ADAPTER_MAX_RESPONSE_BYTES: process.env.GARMIN_ADAPTER_MAX_RESPONSE_BYTES,
      GARMIN_MAX_FIT_BYTES: process.env.GARMIN_MAX_FIT_BYTES,
      MCP_SERVER_URL: process.env.MCP_SERVER_URL,
      MCP_OAUTH_ISSUER: process.env.MCP_OAUTH_ISSUER,
      MCP_OAUTH_AUDIENCE: process.env.MCP_OAUTH_AUDIENCE,
      MCP_OAUTH_SCOPE: process.env.MCP_OAUTH_SCOPE,
      MCP_ALLOWED_ORIGINS: process.env.MCP_ALLOWED_ORIGINS,
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
