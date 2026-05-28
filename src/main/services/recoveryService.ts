import { randomBytes } from 'crypto'
import {
  createMasterSalt,
  decryptSecret,
  deriveSessionKey,
  encryptSecret,
  hashMasterPassword,
  verifyMasterPassword,
} from '../crypto/vaultCrypto'
import { getDatabase, persistDatabase } from '../db/database'
import { getSetting, readEntryRows, setSetting } from '../db/helpers'
import { getSessionKey, isUnlocked, unlockSession } from './sessionService'

const RECOVERY_SALT_KEY = 'recovery_salt'
const RECOVERY_HASH_KEY = 'recovery_hash'
const RECOVERY_WRAP_SALT_KEY = 'recovery_wrap_salt'
const RECOVERY_WRAP_KEY = 'recovery_wrap'

const RECOVERY_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function normalizeRecoveryKey(input: string): string {
  return input.replace(/[-\s]/g, '').toUpperCase()
}

export function formatRecoveryKey(raw: string): string {
  const normalized = normalizeRecoveryKey(raw)
  const parts: string[] = []
  for (let i = 0; i < normalized.length; i += 4) {
    parts.push(normalized.slice(i, i + 4))
  }
  return parts.join('-')
}

export function generateRecoveryKeyValue(): string {
  const chars: string[] = []
  for (let i = 0; i < 20; i += 1) {
    chars.push(RECOVERY_CHARSET[randomBytes(1)[0] % RECOVERY_CHARSET.length])
  }
  return formatRecoveryKey(chars.join(''))
}

export function isRecoveryKeyConfigured(): boolean {
  return Boolean(getSetting(RECOVERY_HASH_KEY) && getSetting(RECOVERY_WRAP_KEY))
}

export function getRecoveryStatus(): { configured: boolean } {
  return { configured: isRecoveryKeyConfigured() }
}

function assertRecoveryKeyFormat(normalized: string): void {
  if (!/^[A-Z2-9]{20}$/.test(normalized)) {
    throw new Error('恢复密钥格式不正确')
  }
}

export function verifyRecoveryKey(recoveryKey: string): boolean {
  if (!isRecoveryKeyConfigured()) return false
  const normalized = normalizeRecoveryKey(recoveryKey)
  assertRecoveryKeyFormat(normalized)
  const salt = getSetting(RECOVERY_SALT_KEY)
  const hash = getSetting(RECOVERY_HASH_KEY)
  if (!salt || !hash) return false
  return verifyMasterPassword(normalized, salt, hash)
}

function wrapSessionKey(sessionKey: Buffer, recoveryKey: string): void {
  const normalized = normalizeRecoveryKey(recoveryKey)
  const wrapSalt = createMasterSalt()
  const wrapKey = deriveSessionKey(normalized, wrapSalt)
  const wrapped = encryptSecret(sessionKey.toString('hex'), wrapKey)
  setSetting(RECOVERY_WRAP_SALT_KEY, wrapSalt)
  setSetting(RECOVERY_WRAP_KEY, wrapped)
}

function unwrapSessionKey(recoveryKey: string): Buffer {
  const normalized = normalizeRecoveryKey(recoveryKey)
  const wrapSalt = getSetting(RECOVERY_WRAP_SALT_KEY)
  const wrapped = getSetting(RECOVERY_WRAP_KEY)
  if (!wrapSalt || !wrapped) {
    throw new Error('尚未设置恢复密钥')
  }
  const wrapKey = deriveSessionKey(normalized, wrapSalt)
  const sessionHex = decryptSecret(wrapped, wrapKey)
  return Buffer.from(sessionHex, 'hex')
}

function storeRecoveryKeyHash(recoveryKey: string): void {
  const normalized = normalizeRecoveryKey(recoveryKey)
  const salt = createMasterSalt()
  const hash = hashMasterPassword(normalized, salt)
  setSetting(RECOVERY_SALT_KEY, salt)
  setSetting(RECOVERY_HASH_KEY, hash)
}

export function createRecoveryKey(): { recoveryKey: string } {
  if (!isUnlocked()) {
    throw new Error('请先解锁保险库')
  }
  const recoveryKey = generateRecoveryKeyValue()
  const normalized = normalizeRecoveryKey(recoveryKey)
  storeRecoveryKeyHash(normalized)
  wrapSessionKey(getSessionKey(), normalized)
  return { recoveryKey }
}

export function regenerateRecoveryKey(masterPassword: string): { recoveryKey: string } {
  if (!isUnlocked()) {
    throw new Error('请先解锁保险库')
  }
  const salt = getSetting('master_salt')
  const hash = getSetting('master_hash')
  if (!salt || !hash) {
    throw new Error('主密码未设置')
  }
  if (!verifyMasterPassword(masterPassword, salt, hash)) {
    throw new Error('主密码不正确')
  }
  return createRecoveryKey()
}

export function resetMasterPasswordWithRecovery(
  recoveryKey: string,
  newMasterPassword: string,
  confirmPassword: string,
): void {
  if (isUnlocked()) {
    throw new Error('请先锁定保险库后再重置主密码')
  }
  if (!isRecoveryKeyConfigured()) {
    throw new Error('尚未设置恢复密钥，无法通过此方式恢复')
  }
  if (newMasterPassword.length < 4) {
    throw new Error('主密码至少需要 4 位')
  }
  if (newMasterPassword !== confirmPassword) {
    throw new Error('两次输入的主密码不一致')
  }
  if (!verifyRecoveryKey(recoveryKey)) {
    throw new Error('恢复密钥无效，请检查后重试')
  }

  const oldKey = unwrapSessionKey(recoveryKey)
  const rows = readEntryRows()
  const decryptedPasswords = rows.map((row) => ({
    id: row.id,
    password: decryptSecret(row.password_encrypted, oldKey),
  }))

  const masterSalt = createMasterSalt()
  const masterHash = hashMasterPassword(newMasterPassword, masterSalt)
  const newKey = deriveSessionKey(newMasterPassword, masterSalt)

  setSetting('master_salt', masterSalt)
  setSetting('master_hash', masterHash)

  const db = getDatabase()
  decryptedPasswords.forEach(({ id, password }) => {
    db.run('UPDATE password_entries SET password_encrypted = ?, updated_at = ? WHERE id = ?', [
      encryptSecret(password, newKey),
      Date.now(),
      id,
    ])
  })
  persistDatabase()

  wrapSessionKey(newKey, recoveryKey)
  unlockSession(newKey)
}

export function getLockedEntryCount(): number {
  return readEntryRows().length
}

export function clearRecoveryKeyData(): void {
  setSetting(RECOVERY_SALT_KEY, '')
  setSetting(RECOVERY_HASH_KEY, '')
  setSetting(RECOVERY_WRAP_SALT_KEY, '')
  setSetting(RECOVERY_WRAP_KEY, '')
}
