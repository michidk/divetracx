import { mkdirSync } from 'node:fs'
import { GarminConnect } from 'garmin-connect'
import { getGarminAdapterEnvironment } from '@/modules/garmin-adapter/server/environment.server'

const environment = getGarminAdapterEnvironment()
const email = environment.GARMIN_EMAIL ?? prompt('Garmin Connect email:')
const password = environment.GARMIN_PASSWORD ?? prompt('Garmin Connect password:')
if (!email || !password) {
  throw new Error('A Garmin Connect email and password are required to log in')
}

const client = new GarminConnect({ username: email, password }, environment.GARMIN_DOMAIN)
await client.login()
const profile = await client.getUserProfile()
mkdirSync(environment.GARMIN_TOKEN_DIRECTORY, { recursive: true })
client.exportTokenToFile(environment.GARMIN_TOKEN_DIRECTORY)

console.log(
  `Logged in as ${profile.displayName ?? email}; tokens saved to ` +
    environment.GARMIN_TOKEN_DIRECTORY,
)
