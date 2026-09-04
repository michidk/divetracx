import '@tanstack/react-start/server-only'

import { diveMateConnector } from '@/modules/divemate/server/sync.server'
import { garminConnector } from '@/modules/garmin/server/connector.server'
import { subsurfaceConnector } from '@/modules/subsurface/server/connector.server'
import type { IntegrationConnector } from './types'

const connectors = new Map<string, IntegrationConnector>([
  [diveMateConnector.descriptor.key, diveMateConnector as IntegrationConnector],
  [garminConnector.descriptor.key, garminConnector as IntegrationConnector],
  [subsurfaceConnector.descriptor.key, subsurfaceConnector as IntegrationConnector],
])

export function listIntegrationConnectors() {
  return [...connectors.values()]
}

export function getIntegrationConnector(key: string) {
  const connector = connectors.get(key)
  if (!connector) throw new Error(`Unknown integration: ${key}`)
  return connector
}
