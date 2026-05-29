import { getDefaultSettings } from './sessionService'
import { getSetting, setSetting } from '../db/helpers'
import type { CloseWindowAction, SecuritySettings } from '../../shared/types'

const SETTINGS_KEYS = {
  autoLockMinutes: 'auto_lock_minutes',
  clipboardClearEnabled: 'clipboard_clear_enabled',
  clipboardClearSeconds: 'clipboard_clear_seconds',
  closeWindowAction: 'close_window_action',
} as const

function parseCloseWindowAction(raw: string | null | undefined): CloseWindowAction {
  if (raw === 'tray' || raw === 'quit') return raw
  return 'ask'
}

export function getSecuritySettings(): SecuritySettings {
  const defaults = getDefaultSettings()
  return {
    autoLockMinutes: Number(getSetting(SETTINGS_KEYS.autoLockMinutes) ?? defaults.autoLockMinutes),
    clipboardClearEnabled:
      (getSetting(SETTINGS_KEYS.clipboardClearEnabled) ?? String(defaults.clipboardClearEnabled)) ===
      'true',
    clipboardClearSeconds: Number(
      getSetting(SETTINGS_KEYS.clipboardClearSeconds) ?? defaults.clipboardClearSeconds,
    ),
    closeWindowAction: parseCloseWindowAction(
      getSetting(SETTINGS_KEYS.closeWindowAction) ?? defaults.closeWindowAction,
    ),
  }
}

export function updateSecuritySettings(partial: Partial<SecuritySettings>): SecuritySettings {
  const current = getSecuritySettings()
  const next = { ...current, ...partial }

  setSetting(SETTINGS_KEYS.autoLockMinutes, String(next.autoLockMinutes))
  setSetting(SETTINGS_KEYS.clipboardClearEnabled, String(next.clipboardClearEnabled))
  setSetting(SETTINGS_KEYS.clipboardClearSeconds, String(next.clipboardClearSeconds))
  setSetting(SETTINGS_KEYS.closeWindowAction, next.closeWindowAction)

  return next
}
