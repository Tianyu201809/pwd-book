import http from 'http'
import https from 'https'
import type { SyncPairingConfig } from './syncTypes'
import { SYNC_BUNDLE_FILENAME } from './syncTypes'

export const SYNC_WEBDAV_PATH = `/sync/${SYNC_BUNDLE_FILENAME}`
export const SYNC_WEBDAV_USER = 'pwdbook'

export function buildSyncBundleUrl(config: SyncPairingConfig): string {
  const protocol = config.secure === false ? 'http' : 'https'
  return `${protocol}://${config.host}:${config.port}${SYNC_WEBDAV_PATH}`
}

export function parsePairingPayload(raw: string): SyncPairingConfig {
  const parsed = JSON.parse(raw) as Partial<SyncPairingConfig>
  if (!parsed.host || !parsed.port || !parsed.accessPassword || !parsed.fingerprint) {
    throw new Error('SYNC_PAIRING_INVALID')
  }
  return {
    host: parsed.host,
    port: parsed.port,
    accessPassword: parsed.accessPassword,
    fingerprint: parsed.fingerprint,
    verificationCode: parsed.verificationCode,
    secure: parsed.secure !== false,
  }
}

export function buildBasicAuthHeader(accessPassword: string): string {
  const token = Buffer.from(`${SYNC_WEBDAV_USER}:${accessPassword}`).toString('base64')
  return `Basic ${token}`
}

export interface SyncClientFetchOptions {
  rejectUnauthorized?: boolean
}

function requestBuffer(
  config: SyncPairingConfig,
  method: 'GET' | 'PUT',
  body?: Buffer,
  options: SyncClientFetchOptions = {},
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const useHttps = config.secure !== false
    const client = useHttps ? https : http
    const requestOptions: https.RequestOptions = {
      hostname: config.host,
      port: config.port,
      path: SYNC_WEBDAV_PATH,
      method,
      headers: {
        Authorization: buildBasicAuthHeader(config.accessPassword),
        ...(body ? { 'Content-Type': 'application/octet-stream', 'Content-Length': body.length } : {}),
      },
      ...(useHttps && options.rejectUnauthorized === false ? { rejectUnauthorized: false } : {}),
    }

    const req = client.request(requestOptions, (res) => {
      if (method === 'PUT') {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(Buffer.alloc(0))
          return
        }
        reject(new Error(`SYNC_PUSH_FAILED:${res.statusCode ?? 0}`))
        return
      }

      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`SYNC_FETCH_FAILED:${res.statusCode ?? 0}`))
        return
      }

      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })

    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

export async function fetchRemoteEncryptedBundle(
  config: SyncPairingConfig,
  options: SyncClientFetchOptions = {},
): Promise<Buffer> {
  return requestBuffer(config, 'GET', undefined, options)
}

export async function pushRemoteEncryptedBundle(
  config: SyncPairingConfig,
  payload: Buffer,
  options: SyncClientFetchOptions = {},
): Promise<void> {
  await requestBuffer(config, 'PUT', payload, options)
}
