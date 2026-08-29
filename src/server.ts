import type { Register } from '@tanstack/react-router'
import type { RequestHandler } from '@tanstack/react-start/server'
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'

const startHandler = createStartHandler(defaultStreamHandler)

const fetch: RequestHandler<Register> = (request, options) =>
  startHandler(request, options)

export default { fetch }
