import { getGarminAdapterEnvironment } from '@/modules/garmin-adapter/server/environment.server'
import {
  createGarminAdapterDependencies,
  createGarminAdapterFetchHandler,
} from '@/modules/garmin-adapter/server/http.server'
import { GarminConnectSource } from '@/modules/garmin-adapter/server/source.server'

const environment = getGarminAdapterEnvironment()
const server = Bun.serve({
  port: environment.GARMIN_ADAPTER_PORT,
  fetch: createGarminAdapterFetchHandler(
    createGarminAdapterDependencies(environment, new GarminConnectSource(environment)),
    environment,
  ),
})

console.log(
  `Garmin adapter listening on port ${server.port} ` +
    `(tokens: ${environment.GARMIN_TOKEN_DIRECTORY}, domain: ${environment.GARMIN_DOMAIN}). ` +
    'Open the adapter page in a browser to log in to Garmin Connect.',
)
