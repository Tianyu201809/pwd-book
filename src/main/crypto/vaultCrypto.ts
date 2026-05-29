import { randomBytes, scryptSync, createCipheriv, createDecipheriv, timingSafeEqual } from 'crypto'
import type { PasswordGenOptions } from '../../shared/types'
import {
  DEFAULT_PASSWORD_GEN_OPTIONS,
  generatePasswordWithOptions,
} from '../../shared/passwordGenerator'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 12
const TAG_LENGTH = 16
const MASTER_SALT_LENGTH = 16
const MASTER_HASH_LENGTH = 64

export function createMasterSalt(): string {
  return randomBytes(MASTER_SALT_LENGTH).toString('hex')
}

export function hashMasterPassword(password: string, saltHex: string): string {
  const salt = Buffer.from(saltHex, 'hex')
  return scryptSync(password, salt, MASTER_HASH_LENGTH).toString('hex')
}

export function verifyMasterPassword(password: string, saltHex: string, hashHex: string): boolean {
  const actual = Buffer.from(hashMasterPassword(password, saltHex), 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

export function deriveSessionKey(password: string, saltHex: string): Buffer {
  return scryptSync(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH)
}

export function encryptSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptSecret(payload: string, key: Buffer): string {
  const buffer = Buffer.from(payload, 'base64')
  const iv = buffer.subarray(0, IV_LENGTH)
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const data = buffer.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

export function generatePassword(length = 16, options?: Partial<PasswordGenOptions>): string {
  return generatePasswordWithOptions({
    ...DEFAULT_PASSWORD_GEN_OPTIONS,
    length,
    ...options,
  })
}
