import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  completeGarminMfaAccount,
  connectGarminAccount,
  disconnectGarminAccount,
  loadGarminAccountStatus,
} from './account.server'

export const getGarminAccountStatus = createServerFn({ method: 'GET' }).handler(
  loadGarminAccountStatus,
)

export const connectGarmin = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      email: z.email(),
      password: z.string().min(1),
    }),
  )
  .handler(({ data }) => connectGarminAccount(data.email, data.password))

export const completeGarminMfa = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      challengeId: z.string().min(1),
      code: z.string().trim().min(1).max(32),
    }),
  )
  .handler(({ data }) => completeGarminMfaAccount(data.challengeId, data.code))

export const disconnectGarmin = createServerFn({ method: 'POST' }).handler(() =>
  disconnectGarminAccount(),
)
