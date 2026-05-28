import type { SecuritySettings } from '../../shared/types'

const DEFAULT_SETTINGS: SecuritySettings = {
  autoLockMinutes: 15,
  clipboardClearEnabled: true,
  clipboardClearSeconds: 30,
}

let sessionKey: Buffer | null = null

export function isUnlocked(): boolean {
  return sessionKey !== null
}

export function getSessionKey(): Buffer {
  if (!sessionKey) {
    throw new Error('Vault is locked')
  }
  return sessionKey
}

export function unlockSession(key: Buffer): void {
  sessionKey = key
}

export function lockSession(): void {
  sessionKey = null
}

export function getDefaultSettings(): SecuritySettings {
  return { ...DEFAULT_SETTINGS }
}
