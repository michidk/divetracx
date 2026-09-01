import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
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

export const disconnectGarmin = createServerFn({ method: 'POST' }).handler(() =>
  disconnectGarminAccount(),
)
