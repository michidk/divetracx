import '@tanstack/react-start/server-only'

import { z } from 'zod'

const schema = z.object({
  GARMIN_ADAPTER_PORT: z.coerce.number().int().positive().default(8787),
  GARMIN_ADAPTER_AUTHORIZATION: z.string().trim().min(1).optional(),
  GARMIN_TOKEN_DIRECTORY: z.string().trim().min(1).default('/data/garmin-tokens'),
  GARMIN_DOMAIN: z.enum(['garmin.com', 'garmin.cn']).default('garmin.com'),
  GARMIN_ACTIVITY_PAGE_SIZE: z.coerce.number().int().positive().max(200).default(50),
  GARMIN_FULL_IMPORT_MAX_ACTIVITIES: z.coerce.number().int().positive().default(2_000),
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
})

export type GarminAdapterEnvironment = z.infer<typeof schema>

export function getGarminAdapterEnvironment(): GarminAdapterEnvironment {
  const source = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== ''),
  )
  return schema.parse(source)
}
