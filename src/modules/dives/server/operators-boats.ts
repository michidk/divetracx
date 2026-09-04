import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  createOperationTaxonomy,
  deleteOperationTaxonomy,
  loadOperatorsAndBoats,
  renameOperationTaxonomy,
} from './operators-boats.server'

const taxonomySchema = z.enum(['operator', 'boat'])
const nameSchema = z.string().max(120)
const idSchema = z.string().uuid()

export const getOperatorsAndBoats = createServerFn({ method: 'GET' }).handler(() =>
  loadOperatorsAndBoats(),
)

export const addOperationTaxonomy = createServerFn({ method: 'POST' })
  .validator(z.object({ taxonomy: taxonomySchema, name: nameSchema }))
  .handler(({ data }) => createOperationTaxonomy(data.taxonomy, data.name))

export const updateOperationTaxonomy = createServerFn({ method: 'POST' })
  .validator(z.object({ taxonomy: taxonomySchema, id: idSchema, name: nameSchema }))
  .handler(({ data }) => renameOperationTaxonomy(data.taxonomy, data.id, data.name))

export const removeOperationTaxonomy = createServerFn({ method: 'POST' })
  .validator(z.object({ taxonomy: taxonomySchema, id: idSchema }))
  .handler(({ data }) => deleteOperationTaxonomy(data.taxonomy, data.id))
