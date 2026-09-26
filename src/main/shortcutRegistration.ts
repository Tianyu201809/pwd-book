import { appError, ErrorCode } from '../shared/errors'
import type { SecuritySettings } from '../shared/types'
import { registerClipboardWindowShortcut } from './clipboardWindow'
import { registerMainWindowShortcut } from './mainWindowShortcut'
import { registerNotesManagerShortcut } from './noteWindows'
import { registerQuickBarShortcut } from './quickBar'
import { updateSecuritySettings } from './services/settingsService'

export function reregisterGlobalShortcuts(
  partial: Partial<SecuritySettings>,
  previous: SecuritySettings,
): void {
  const quickBarOk = registerQuickBarShortcut()
  const clipboardOk = registerClipboardWindowShortcut()
  const notesOk = registerNotesManagerShortcut()
  const mainOk = registerMainWindowShortcut()
  const rollback: Partial<SecuritySettings> = {}

  if (!quickBarOk && partial.quickBarAccelerator !== undefined) {
    rollback.quickBarAccelerator = previous.quickBarAccelerator
  } else if (!quickBarOk && partial.quickBarEnabled !== undefined) {
    rollback.quickBarEnabled = previous.quickBarEnabled
  }
  if (!clipboardOk && partial.clipboardAccelerator !== undefined) {
    rollback.clipboardAccelerator = previous.clipboardAccelerator
  }
  if (!notesOk && partial.notesManagerAccelerator !== undefined) {
    rollback.notesManagerAccelerator = previous.notesManagerAccelerator
  } else if (!notesOk && partial.notesManagerShortcutEnabled !== undefined) {
    rollback.notesManagerShortcutEnabled = previous.notesManagerShortcutEnabled
  }
  if (!mainOk && partial.mainWindowShortcutAccelerator !== undefined) {
    rollback.mainWindowShortcutAccelerator = previous.mainWindowShortcutAccelerator
  } else if (!mainOk && partial.mainWindowShortcutEnabled !== undefined) {
    rollback.mainWindowShortcutEnabled = previous.mainWindowShortcutEnabled
  }

  if (Object.keys(rollback).length === 0) return
  updateSecuritySettings(rollback)
  registerQuickBarShortcut()
  registerClipboardWindowShortcut()
  registerNotesManagerShortcut()
  registerMainWindowShortcut()
  throw appError(ErrorCode.SHORTCUT_IN_USE)
}
