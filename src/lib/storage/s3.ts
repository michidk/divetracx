import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import type { StorageConfig, StorageProvider } from './types'

export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client
  private readonly bucket: string

  constructor(config: NonNullable<StorageConfig['s3']>) {
    this.bucket = config.bucket
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: Boolean(config.endpoint),
    })
  }

  async upload(file: File | Blob, path: string) {
    const body = new Uint8Array(await file.arrayBuffer())
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
        Body: body,
        ContentLength: body.byteLength,
        ContentType: file.type || 'application/octet-stream',
      }),
    )
    return path
  }

  async download(path: string) {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: path }),
    )
    return new Blob([await new Response(response.Body as ReadableStream).arrayBuffer()], {
      type: response.ContentType,
    })
  }

  async delete(path: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: path }))
  }

  getUrl(path: string) {
    return `https://${this.bucket}.s3.amazonaws.com/${path}`
  }

  async exists(path: string) {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: path }))
      return true
    } catch {
      return false
    }
  }
}
