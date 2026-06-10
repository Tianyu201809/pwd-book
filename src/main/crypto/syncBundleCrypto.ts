import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'crypto'
import type { SyncBundle } from '../../shared/syncTypes'
import { SYNC_BUNDLE_FORMAT, SYNC_BUNDLE_VERSION, SYNC_MAGIC } from '../../shared/syncTypes'
import { deriveSyncTransportKey } from './vaultCrypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16
const SALT_LENGTH = 16
function resolveTransportKey(masterPasswordOrKey: string | Buffer): Buffer {
  return Buffer.isBuffer(masterPasswordOrKey)
    ? masterPasswordOrKey
    : deriveSyncTransportKey(masterPasswordOrKey)
}

export function encryptSyncBundle(bundle: SyncBundle, masterPasswordOrKey: string | Buffer): Buffer {
  const salt = randomBytes(SALT_LENGTH)
  const key = resolveTransportKey(masterPasswordOrKey)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const plaintext = Buffer.from(JSON.stringify(bundle), 'utf8')
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  const magic = Buffer.from(SYNC_MAGIC, 'ascii')
  const version = Buffer.from([SYNC_BUNDLE_VERSION])
  return Buffer.concat([magic, version, salt, iv, tag, encrypted])
}

export function decryptSyncBundle(payload: Buffer, masterPasswordOrKey: string | Buffer): SyncBundle {
  const magic = payload.subarray(0, 4).toString('ascii')
  if (magic !== SYNC_MAGIC) {
    throw new Error('SYNC_BUNDLE_INVALID_FORMAT')
  }

  const version = payload[4]
  if (version !== SYNC_BUNDLE_VERSION) {
    throw new Error('SYNC_BUNDLE_UNSUPPORTED_VERSION')
  }

  let offset = 5
  offset += SALT_LENGTH
  const iv = payload.subarray(offset, offset + IV_LENGTH)
  offset += IV_LENGTH
  const tag = payload.subarray(offset, offset + TAG_LENGTH)
  offset += TAG_LENGTH
  const encrypted = payload.subarray(offset)

  const key = resolveTransportKey(masterPasswordOrKey)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted: Buffer
  try {
    decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  } catch {
    throw new Error('SYNC_BUNDLE_DECRYPT_FAILED')
  }

  const bundle = JSON.parse(decrypted.toString('utf8')) as SyncBundle
  if (bundle.format !== SYNC_BUNDLE_FORMAT || bundle.version !== SYNC_BUNDLE_VERSION) {
    throw new Error('SYNC_BUNDLE_INVALID_CONTENT')
  }
  return bundle
}

export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
