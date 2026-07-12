import type { SecuritySettings } from '../../shared/types'
import { appError, ErrorCode } from '../../shared/errors'

const DEFAULT_SETTINGS: SecuritySettings = {
  autoLockMinutes: 15,
  clipboardClearEnabled: true,
  clipboardClearSeconds: 30,
  closeWindowAction: 'ask',
  quickBarEnabled: true,
  quickBarAccelerator: 'Alt+Shift+P',
  quickBarRecentLimit: 5,
  mainWindowShortcutEnabled: true,
  mainWindowShortcutAccelerator: 'Alt+Shift+M',
  browserFillEnabled: false,
  trashRetentionDays: 30,
  launchAtLoginEnabled: false,
}

let sessionKey: Buffer | null = null
let syncTransportKey: Buffer | null = null

export function isUnlocked(): boolean {
  return sessionKey !== null
}

export function getSessionKey(): Buffer {
  if (!sessionKey) {
    throw appError(ErrorCode.VAULT_LOCKED)
  }
  return sessionKey
}

export function getSyncTransportKey(): Buffer {
  if (!syncTransportKey) {
    throw appError(ErrorCode.VAULT_LOCKED)
  }
  return syncTransportKey
}

export function unlockSession(key: Buffer, transportKey?: Buffer): void {
  sessionKey = key
  syncTransportKey = transportKey ?? null
}

export function lockSession(): void {
  sessionKey = null
  syncTransportKey = null
}

export function getDefaultSettings(): SecuritySettings {
  return { ...DEFAULT_SETTINGS }
}
