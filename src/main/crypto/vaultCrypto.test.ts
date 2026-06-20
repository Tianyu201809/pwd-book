import { describe, expect, it } from 'vitest'
import {
  decryptBuffer,
  decryptSecret,
  deriveSessionKey,
  encryptBuffer,
  encryptSecret,
} from './vaultCrypto'

const key = deriveSessionKey('test-password', 'a'.repeat(32))

describe('vaultCrypto buffer encryption', () => {
  it('round-trips binary data', () => {
    const original = Buffer.from([0, 1, 255, 128, 64, 32, 16, 8])
    const encrypted = encryptBuffer(original, key)
    const decrypted = decryptBuffer(encrypted, key)
    expect(decrypted.equals(original)).toBe(true)
  })

  it('round-trips utf8 strings via buffer helpers', () => {
    const text = 'hello 世界 🔐'
    const encrypted = encryptBuffer(Buffer.from(text, 'utf8'), key)
    expect(decryptBuffer(encrypted, key).toString('utf8')).toBe(text)
  })

  it('remains compatible with encryptSecret/decryptSecret', () => {
    const text = 'secret-value'
    const encrypted = encryptSecret(text, key)
    expect(decryptSecret(encrypted, key)).toBe(text)
    expect(decryptBuffer(encrypted, key).toString('utf8')).toBe(text)
  })

  it('fails on tampered ciphertext', () => {
    const encrypted = encryptBuffer(Buffer.from('data'), key)
    const buffer = Buffer.from(encrypted, 'base64')
    buffer[buffer.length - 1] ^= 0xff
    expect(() => decryptBuffer(buffer.toString('base64'), key)).toThrow()
  })
})
