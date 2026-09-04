import '@tanstack/react-start/server-only'

import { getServerEnv } from '@/env'
import { importSubsurfaceUpload } from '@/modules/integrations/server/operations.server'
import { SubsurfaceParseError } from '../parser'

const ACCEPTED_EXTENSIONS = ['.ssrf', '.xml']

function errorResponse(status: number, message: string) {
  return Response.json({ error: message }, { status })
}

export async function handleSubsurfaceUpload(request: Request): Promise<Response> {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return errorResponse(400, 'Expected a multipart form upload')
  }
  const file = formData.get('file')
  if (!(file instanceof File))
    return errorResponse(400, 'Choose a Subsurface logbook file')
  const fileName = file.name.trim() || 'logbook.ssrf'
  const lowerName = fileName.toLowerCase()
  if (!ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
    return errorResponse(415, `${fileName} is not a Subsurface .ssrf or .xml logbook`)
  }
  const maximumBytes = getServerEnv().SUBSURFACE_MAX_UPLOAD_BYTES
  if (file.size > maximumBytes) {
    return errorResponse(
      413,
      `${fileName} exceeds ${Math.round(maximumBytes / (1024 * 1024))} MB`,
    )
  }

  try {
    const result = await importSubsurfaceUpload({ fileName, xml: await file.text() })
    return Response.json(result)
  } catch (error) {
    if (error instanceof SubsurfaceParseError) return errorResponse(422, error.message)
    const message = error instanceof Error ? error.message : 'Subsurface import failed'
    return errorResponse(500, message)
  }
}
