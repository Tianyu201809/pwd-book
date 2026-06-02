import { globalShortcut } from 'electron'
import { getSecuritySettings } from './services/settingsService'
import { showFromTray } from './tray'

let registeredAccelerator: string | null = null

export function unregisterMainWindowShortcut(): void {
  if (registeredAccelerator) {
    globalShortcut.unregister(registeredAccelerator)
    registeredAccelerator = null
  }
}

export function registerMainWindowShortcut(): void {
  const { mainWindowShortcutEnabled, mainWindowShortcutAccelerator } = getSecuritySettings()
  unregisterMainWindowShortcut()
  if (!mainWindowShortcutEnabled) return
  const ok = globalShortcut.register(mainWindowShortcutAccelerator, () => {
    showFromTray()
  })
  if (ok) {
    registeredAccelerator = mainWindowShortcutAccelerator
  }
}
