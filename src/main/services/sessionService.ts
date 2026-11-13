import { DEFAULT_ACCELERATORS } from '../../shared/globalAccelerator'
import type { SecuritySettings } from '../../shared/types'
import { appError, ErrorCode } from '../../shared/errors'

const DEFAULT_SETTINGS: SecuritySettings = {
  autoLockMinutes: 15,
  clipboardClearEnabled: true,
  clipboardEnabled: false,
  clipboardDefaultExpiry: 300,
  clipboardPersistence: false,
  clipboardHistoryLimit: 50,
  clipboardQuickMode: false,
  clipboardAccelerator: DEFAULT_ACCELERATORS.clipboard,
  clipboardClearSeconds: 30,
  closeWindowAction: 'ask',
  quickBarEnabled: true,
  quickBarAccelerator: DEFAULT_ACCELERATORS.quickBar,
  quickBarRecentLimit: 5,
  mainWindowShortcutEnabled: true,
  mainWindowShortcutAccelerator: DEFAULT_ACCELERATORS.main,
  notesManagerShortcutEnabled: true,
  notesManagerAccelerator: DEFAULT_ACCELERATORS.notes,
  browserFillEnabled: false,
  trashRetentionDays: 30,
  launchAtLoginEnabled: false,
}

let sessionKey: Buffer | null = null
let syncTransportKey: Buffer | null = null
let sessionAccountId: string | null = null

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

export function unlockSession(key: Buffer, transportKey: Buffer | undefined, accountId: string): void {
  sessionKey = key
  syncTransportKey = transportKey ?? null
  sessionAccountId = accountId
}

export function getSessionAccountId(): string | null {
  return sessionAccountId
}

export function lockSession(): void {
  sessionKey = null
  syncTransportKey = null
  sessionAccountId = null
}

export function getDefaultSettings(): SecuritySettings {
  return { ...DEFAULT_SETTINGS }
}
