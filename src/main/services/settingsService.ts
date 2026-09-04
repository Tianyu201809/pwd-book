import { getDefaultSettings } from './sessionService'
import { getSetting, setSetting } from '../db/helpers'
import { clampQuickBarRecentLimit } from '../../shared/quickBarLimits'
import type { CloseWindowAction, SecuritySettings } from '../../shared/types'
import { truncateQuickBarRecentToLimit } from './quickBarRecentService'

const SETTINGS_KEYS = {
  autoLockMinutes: 'auto_lock_minutes',
  clipboardClearEnabled: 'clipboard_clear_enabled',
  clipboardEnabled: 'clipboard_enabled',
  clipboardDefaultExpiry: 'clipboard_default_expiry',
  clipboardPersistence: 'clipboard_persistence',
  clipboardClearSeconds: 'clipboard_clear_seconds',
  closeWindowAction: 'close_window_action',
  quickBarEnabled: 'quick_bar_enabled',
  quickBarAccelerator: 'quick_bar_accelerator',
  quickBarRecentLimit: 'quick_bar_recent_limit',
  mainWindowShortcutEnabled: 'main_window_shortcut_enabled',
  mainWindowShortcutAccelerator: 'main_window_shortcut_accelerator',
  browserFillEnabled: 'browser_fill_enabled',
  trashRetentionDays: 'trash_retention_days',
  launchAtLoginEnabled: 'launch_at_login_enabled',
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
    clipboardEnabled:
      (getSetting(SETTINGS_KEYS.clipboardEnabled) ?? String(defaults.clipboardEnabled)) === 'true',
    clipboardDefaultExpiry: parseClipboardDefaultExpiry(
      getSetting(SETTINGS_KEYS.clipboardDefaultExpiry) ?? String(defaults.clipboardDefaultExpiry),
      defaults.clipboardDefaultExpiry,
    ),
    clipboardPersistence:
      (getSetting(SETTINGS_KEYS.clipboardPersistence) ?? String(defaults.clipboardPersistence)) ===
      'true',
    clipboardClearSeconds: Number(
      getSetting(SETTINGS_KEYS.clipboardClearSeconds) ?? defaults.clipboardClearSeconds,
    ),
    closeWindowAction: parseCloseWindowAction(
      getSetting(SETTINGS_KEYS.closeWindowAction) ?? defaults.closeWindowAction,
    ),
    quickBarEnabled:
      (getSetting(SETTINGS_KEYS.quickBarEnabled) ?? String(defaults.quickBarEnabled)) === 'true',
    quickBarAccelerator:
      getSetting(SETTINGS_KEYS.quickBarAccelerator) ?? defaults.quickBarAccelerator,
    quickBarRecentLimit: clampQuickBarRecentLimit(
      getSetting(SETTINGS_KEYS.quickBarRecentLimit) ?? defaults.quickBarRecentLimit,
    ),
    mainWindowShortcutEnabled:
      (getSetting(SETTINGS_KEYS.mainWindowShortcutEnabled) ??
        String(defaults.mainWindowShortcutEnabled)) === 'true',
    mainWindowShortcutAccelerator:
      getSetting(SETTINGS_KEYS.mainWindowShortcutAccelerator) ??
      defaults.mainWindowShortcutAccelerator,
    browserFillEnabled:
      (getSetting(SETTINGS_KEYS.browserFillEnabled) ?? String(defaults.browserFillEnabled)) ===
      'true',
    trashRetentionDays: Number(
      getSetting(SETTINGS_KEYS.trashRetentionDays) ?? defaults.trashRetentionDays,
    ),
    launchAtLoginEnabled:
      (getSetting(SETTINGS_KEYS.launchAtLoginEnabled) ??
        String(defaults.launchAtLoginEnabled)) === 'true',
  }
}

function parseClipboardDefaultExpiry(raw: string, fallback: SecuritySettings['clipboardDefaultExpiry']): SecuritySettings['clipboardDefaultExpiry'] {
  const value = Number(raw)
  return value === 0 || value === 30 || value === 300 || value === 900 || value === 1800 ? value : fallback
}

export function updateSecuritySettings(partial: Partial<SecuritySettings>): SecuritySettings {
  const current = getSecuritySettings()
  const next = {
    ...current,
    ...partial,
    quickBarRecentLimit: clampQuickBarRecentLimit(
      partial.quickBarRecentLimit ?? current.quickBarRecentLimit,
    ),
  }

  setSetting(SETTINGS_KEYS.autoLockMinutes, String(next.autoLockMinutes))
  setSetting(SETTINGS_KEYS.clipboardClearEnabled, String(next.clipboardClearEnabled))
  setSetting(SETTINGS_KEYS.clipboardEnabled, String(next.clipboardEnabled))
  setSetting(SETTINGS_KEYS.clipboardDefaultExpiry, String(next.clipboardDefaultExpiry))
  setSetting(SETTINGS_KEYS.clipboardPersistence, String(next.clipboardPersistence))
  setSetting(SETTINGS_KEYS.clipboardClearSeconds, String(next.clipboardClearSeconds))
  setSetting(SETTINGS_KEYS.closeWindowAction, next.closeWindowAction)
  setSetting(SETTINGS_KEYS.quickBarEnabled, String(next.quickBarEnabled))
  setSetting(SETTINGS_KEYS.quickBarAccelerator, next.quickBarAccelerator)
  setSetting(SETTINGS_KEYS.quickBarRecentLimit, String(next.quickBarRecentLimit))
  setSetting(SETTINGS_KEYS.mainWindowShortcutEnabled, String(next.mainWindowShortcutEnabled))
  setSetting(SETTINGS_KEYS.mainWindowShortcutAccelerator, next.mainWindowShortcutAccelerator)
  setSetting(SETTINGS_KEYS.browserFillEnabled, String(next.browserFillEnabled))
  setSetting(SETTINGS_KEYS.trashRetentionDays, String(next.trashRetentionDays))
  setSetting(SETTINGS_KEYS.launchAtLoginEnabled, String(next.launchAtLoginEnabled))

  if (next.quickBarRecentLimit !== current.quickBarRecentLimit) {
    truncateQuickBarRecentToLimit()
  }

  return next
}
