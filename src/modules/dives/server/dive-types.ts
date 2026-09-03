import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  createDiveType,
  deleteDiveType,
  loadDiveTypes,
  renameDiveType,
} from './dive-types.server'

const nameSchema = z.string().max(120)
const idSchema = z.string().uuid()

export const getDiveTypes = createServerFn({ method: 'GET' }).handler(() =>
  loadDiveTypes(),
)

export const addDiveType = createServerFn({ method: 'POST' })
  .validator(z.object({ name: nameSchema }))
  .handler(({ data }) => createDiveType(data.name))

export const updateDiveType = createServerFn({ method: 'POST' })
  .validator(z.object({ id: idSchema, name: nameSchema }))
  .handler(({ data }) => renameDiveType(data.id, data.name))

export const removeDiveType = createServerFn({ method: 'POST' })
  .validator(z.object({ id: idSchema }))
  .handler(({ data }) => deleteDiveType(data.id))
