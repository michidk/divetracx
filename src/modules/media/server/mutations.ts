import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { deletePictureRecord } from './mutations.server'

export const deletePicture = createServerFn({ method: 'POST' })
  .validator(z.object({ pictureId: z.string().uuid() }))
  .handler(async ({ data }) => {
    await deletePictureRecord(data.pictureId)
  })
