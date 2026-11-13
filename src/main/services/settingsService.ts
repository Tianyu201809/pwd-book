import { app } from 'electron'
import { getDefaultSettings } from './sessionService'
import { readMachineDocument, updateMachineSettings } from '../accounts/machineStore'
import { getSetting, setSetting } from '../db/helpers'
import { clampClipboardHistoryLimit } from '../../shared/clipboardHistoryLimit'
import { appError, ErrorCode } from '../../shared/errors'
import {
  readStoredAccelerator,
  resolveAccelerators,
} from '../../shared/globalAccelerator'
import { defaultMachineSettings, type MachineSettings } from '../../shared/machineDocument'
import { clampQuickBarRecentLimit } from '../../shared/quickBarLimits'
import type { SecuritySettings } from '../../shared/types'
import { truncateQuickBarRecentToLimit } from './quickBarRecentService'

const SETTINGS_KEYS = {
  autoLockMinutes: 'auto_lock_minutes',
  clipboardClearEnabled: 'clipboard_clear_enabled',
  clipboardEnabled: 'clipboard_enabled',
  clipboardDefaultExpiry: 'clipboard_default_expiry',
  clipboardPersistence: 'clipboard_persistence',
  clipboardHistoryLimit: 'clipboard_history_limit',
  clipboardQuickMode: 'clipboard_quick_mode',
  clipboardClearSeconds: 'clipboard_clear_seconds',
  quickBarRecentLimit: 'quick_bar_recent_limit',
  browserFillEnabled: 'browser_fill_enabled',
  trashRetentionDays: 'trash_retention_days',
} as const

function currentMachineSettings(): MachineSettings {
  const document = readMachineDocument(app.getPath('userData'))
  if (document === null) return defaultMachineSettings()
  return document.settings
}

export function getSecuritySettings(): SecuritySettings {
  const defaults = getDefaultSettings()
  const machine = currentMachineSettings()
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
    clipboardHistoryLimit: clampClipboardHistoryLimit(
      getSetting(SETTINGS_KEYS.clipboardHistoryLimit) ?? defaults.clipboardHistoryLimit,
    ),
    clipboardQuickMode:
      (getSetting(SETTINGS_KEYS.clipboardQuickMode) ?? String(defaults.clipboardQuickMode)) ===
      'true',
    clipboardAccelerator: readStoredAccelerator(
      machine.clipboardAccelerator,
      defaults.clipboardAccelerator,
    ),
    clipboardClearSeconds: Number(
      getSetting(SETTINGS_KEYS.clipboardClearSeconds) ?? defaults.clipboardClearSeconds,
    ),
    closeWindowAction: machine.closeWindowAction,
    quickBarEnabled: machine.quickBarEnabled,
    quickBarAccelerator: readStoredAccelerator(
      machine.quickBarAccelerator,
      defaults.quickBarAccelerator,
    ),
    quickBarRecentLimit: clampQuickBarRecentLimit(
      getSetting(SETTINGS_KEYS.quickBarRecentLimit) ?? defaults.quickBarRecentLimit,
    ),
    mainWindowShortcutEnabled: machine.mainWindowShortcutEnabled,
    mainWindowShortcutAccelerator: readStoredAccelerator(
      machine.mainWindowShortcutAccelerator,
      defaults.mainWindowShortcutAccelerator,
    ),
    notesManagerShortcutEnabled: machine.notesManagerShortcutEnabled,
    notesManagerAccelerator: readStoredAccelerator(
      machine.notesManagerAccelerator,
      defaults.notesManagerAccelerator,
    ),
    browserFillEnabled:
      (getSetting(SETTINGS_KEYS.browserFillEnabled) ?? String(defaults.browserFillEnabled)) ===
      'true',
    trashRetentionDays: Number(
      getSetting(SETTINGS_KEYS.trashRetentionDays) ?? defaults.trashRetentionDays,
    ),
    launchAtLoginEnabled: machine.launchAtLoginEnabled,
  }
}

function parseClipboardDefaultExpiry(raw: string, fallback: SecuritySettings['clipboardDefaultExpiry']): SecuritySettings['clipboardDefaultExpiry'] {
  const value = Number(raw)
  return value === 0 || value === 30 || value === 300 || value === 900 || value === 1800 ? value : fallback
}

export function updateSecuritySettings(partial: Partial<SecuritySettings>): SecuritySettings {
  const current = getSecuritySettings()
  const accelerators = resolveAccelerators(
    {
      quickBarAccelerator: current.quickBarAccelerator,
      mainWindowShortcutAccelerator: current.mainWindowShortcutAccelerator,
      notesManagerAccelerator: current.notesManagerAccelerator,
      clipboardAccelerator: current.clipboardAccelerator,
    },
    {
      quickBarAccelerator: partial.quickBarAccelerator,
      mainWindowShortcutAccelerator: partial.mainWindowShortcutAccelerator,
      notesManagerAccelerator: partial.notesManagerAccelerator,
      clipboardAccelerator: partial.clipboardAccelerator,
    },
  )
  if (!accelerators.ok) {
    throw appError(
      accelerators.reason === 'invalid' ? ErrorCode.SHORTCUT_INVALID : ErrorCode.SHORTCUT_CONFLICT,
    )
  }
  const next = {
    ...current,
    ...partial,
    ...accelerators.accelerators,
    quickBarRecentLimit: clampQuickBarRecentLimit(
      partial.quickBarRecentLimit ?? current.quickBarRecentLimit,
    ),
    clipboardHistoryLimit: clampClipboardHistoryLimit(
      partial.clipboardHistoryLimit ?? current.clipboardHistoryLimit,
    ),
  }

  setSetting(SETTINGS_KEYS.autoLockMinutes, String(next.autoLockMinutes))
  setSetting(SETTINGS_KEYS.clipboardClearEnabled, String(next.clipboardClearEnabled))
  setSetting(SETTINGS_KEYS.clipboardEnabled, String(next.clipboardEnabled))
  setSetting(SETTINGS_KEYS.clipboardDefaultExpiry, String(next.clipboardDefaultExpiry))
  setSetting(SETTINGS_KEYS.clipboardPersistence, String(next.clipboardPersistence))
  setSetting(SETTINGS_KEYS.clipboardHistoryLimit, String(next.clipboardHistoryLimit))
  setSetting(SETTINGS_KEYS.clipboardQuickMode, String(next.clipboardQuickMode))
  setSetting(SETTINGS_KEYS.clipboardClearSeconds, String(next.clipboardClearSeconds))
  setSetting(SETTINGS_KEYS.quickBarRecentLimit, String(next.quickBarRecentLimit))
  setSetting(SETTINGS_KEYS.browserFillEnabled, String(next.browserFillEnabled))
  setSetting(SETTINGS_KEYS.trashRetentionDays, String(next.trashRetentionDays))
  updateMachineSettings(app.getPath('userData'), {
    launchAtLoginEnabled: next.launchAtLoginEnabled,
    closeWindowAction: next.closeWindowAction,
    quickBarEnabled: next.quickBarEnabled,
    quickBarAccelerator: next.quickBarAccelerator,
    mainWindowShortcutEnabled: next.mainWindowShortcutEnabled,
    mainWindowShortcutAccelerator: next.mainWindowShortcutAccelerator,
    notesManagerShortcutEnabled: next.notesManagerShortcutEnabled,
    notesManagerAccelerator: next.notesManagerAccelerator,
    clipboardAccelerator: next.clipboardAccelerator,
  })
  if (next.quickBarRecentLimit !== current.quickBarRecentLimit) {
    truncateQuickBarRecentToLimit()
  }

  return next
}
