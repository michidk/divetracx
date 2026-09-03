import '@tanstack/react-start/server-only'

import { getServerEnv } from '@/env'
import { LocalStorageProvider } from './local'
import { S3StorageProvider } from './s3'
import type { StorageProvider } from './types'

let instance: StorageProvider | undefined

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`${name} is required when STORAGE_PROVIDER=s3`)
  return value
}

export function getStorage(): StorageProvider {
  if (instance) return instance
  const environment = getServerEnv()
  instance =
    environment.STORAGE_PROVIDER === 's3'
      ? new S3StorageProvider({
          bucket: required(environment.S3_BUCKET, 'S3_BUCKET'),
          region: environment.S3_REGION,
          endpoint: environment.S3_ENDPOINT,
          accessKeyId: required(environment.S3_ACCESS_KEY_ID, 'S3_ACCESS_KEY_ID'),
          secretAccessKey: required(
            environment.S3_SECRET_ACCESS_KEY,
            'S3_SECRET_ACCESS_KEY',
          ),
        })
      : new LocalStorageProvider({
          basePath: environment.STORAGE_PATH,
          baseUrl: environment.STORAGE_URL,
        })
  return instance
}
