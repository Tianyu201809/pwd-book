import type { SecuritySettings } from '../../shared/types'
import { appError, ErrorCode } from '../../shared/errors'

const DEFAULT_SETTINGS: SecuritySettings = {
  autoLockMinutes: 15,
  clipboardClearEnabled: true,
  clipboardClearSeconds: 30,
  closeWindowAction: 'ask',
  openUrlWithCredentials: false,
}

let sessionKey: Buffer | null = null

export function isUnlocked(): boolean {
  return sessionKey !== null
}

export function getSessionKey(): Buffer {
  if (!sessionKey) {
    throw appError(ErrorCode.VAULT_LOCKED)
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
