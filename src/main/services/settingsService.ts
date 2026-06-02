import { getDefaultSettings } from './sessionService'
import { getSetting, setSetting } from '../db/helpers'
import type { CloseWindowAction, SecuritySettings } from '../../shared/types'

const SETTINGS_KEYS = {
  autoLockMinutes: 'auto_lock_minutes',
  clipboardClearEnabled: 'clipboard_clear_enabled',
  clipboardClearSeconds: 'clipboard_clear_seconds',
  closeWindowAction: 'close_window_action',
  openUrlWithCredentials: 'open_url_with_credentials',
  quickBarEnabled: 'quick_bar_enabled',
  quickBarAccelerator: 'quick_bar_accelerator',
  mainWindowShortcutEnabled: 'main_window_shortcut_enabled',
  mainWindowShortcutAccelerator: 'main_window_shortcut_accelerator',
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
    openUrlWithCredentials:
      (getSetting(SETTINGS_KEYS.openUrlWithCredentials) ??
        String(defaults.openUrlWithCredentials)) === 'true',
    quickBarEnabled:
      (getSetting(SETTINGS_KEYS.quickBarEnabled) ?? String(defaults.quickBarEnabled)) === 'true',
    quickBarAccelerator:
      getSetting(SETTINGS_KEYS.quickBarAccelerator) ?? defaults.quickBarAccelerator,
    mainWindowShortcutEnabled:
      (getSetting(SETTINGS_KEYS.mainWindowShortcutEnabled) ??
        String(defaults.mainWindowShortcutEnabled)) === 'true',
    mainWindowShortcutAccelerator:
      getSetting(SETTINGS_KEYS.mainWindowShortcutAccelerator) ??
      defaults.mainWindowShortcutAccelerator,
  }
}

export function updateSecuritySettings(partial: Partial<SecuritySettings>): SecuritySettings {
  const current = getSecuritySettings()
  const next = { ...current, ...partial }

  setSetting(SETTINGS_KEYS.autoLockMinutes, String(next.autoLockMinutes))
  setSetting(SETTINGS_KEYS.clipboardClearEnabled, String(next.clipboardClearEnabled))
  setSetting(SETTINGS_KEYS.clipboardClearSeconds, String(next.clipboardClearSeconds))
  setSetting(SETTINGS_KEYS.closeWindowAction, next.closeWindowAction)
  setSetting(SETTINGS_KEYS.openUrlWithCredentials, String(next.openUrlWithCredentials))
  setSetting(SETTINGS_KEYS.quickBarEnabled, String(next.quickBarEnabled))
  setSetting(SETTINGS_KEYS.quickBarAccelerator, next.quickBarAccelerator)
  setSetting(SETTINGS_KEYS.mainWindowShortcutEnabled, String(next.mainWindowShortcutEnabled))
  setSetting(SETTINGS_KEYS.mainWindowShortcutAccelerator, next.mainWindowShortcutAccelerator)

  return next
}
