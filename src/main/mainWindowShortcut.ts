import { globalShortcut } from 'electron'
import { DEFAULT_ACCELERATORS, normalizeAccelerator } from '../shared/globalAccelerator'
import { getSecuritySettings } from './services/settingsService'
import { showFromTray } from './tray'

let registeredAccelerator: string | null = null

export function unregisterMainWindowShortcut(): void {
  if (registeredAccelerator) {
    globalShortcut.unregister(registeredAccelerator)
    registeredAccelerator = null
  }
}

export function registerMainWindowShortcut(): boolean {
  const { mainWindowShortcutEnabled, mainWindowShortcutAccelerator } = getSecuritySettings()
  unregisterMainWindowShortcut()
  if (!mainWindowShortcutEnabled) return true
  const accelerator =
    normalizeAccelerator(mainWindowShortcutAccelerator) ?? DEFAULT_ACCELERATORS.main
  try {
    const ok = globalShortcut.register(accelerator, () => {
      showFromTray()
    })
    if (ok) {
      registeredAccelerator = accelerator
      return true
    }
  } catch {
    return false
  }
  return false
}
