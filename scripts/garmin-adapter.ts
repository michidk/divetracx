import { getGarminAdapterEnvironment } from '@/modules/garmin-adapter/server/environment.server'
import { createGarminAdapterFetchHandler } from '@/modules/garmin-adapter/server/http.server'
import { GarminConnectSource } from '@/modules/garmin-adapter/server/source.server'

const environment = getGarminAdapterEnvironment()
const server = Bun.serve({
  port: environment.GARMIN_ADAPTER_PORT,
  fetch: createGarminAdapterFetchHandler(new GarminConnectSource(environment)),
})

console.log(
  `Garmin adapter listening on port ${server.port} ` +
    `(tokens: ${environment.GARMIN_TOKEN_DIRECTORY}, domain: ${environment.GARMIN_DOMAIN})`,
)
