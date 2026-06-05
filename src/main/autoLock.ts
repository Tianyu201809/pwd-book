import { powerMonitor } from 'electron'
import { AUTO_LOCK_FOLLOW_SYSTEM, IPC_EVENTS } from '../shared/types'
import { getSecuritySettings } from './services/settingsService'
import { isUnlocked } from './services/sessionService'
import { lockVault } from './services/vaultService'
import { getMainWindow } from './tray'

export function registerSystemAutoLock(): void {
  powerMonitor.on('lock-screen', () => {
    if (getSecuritySettings().autoLockMinutes !== AUTO_LOCK_FOLLOW_SYSTEM) return
    if (!isUnlocked()) return

    lockVault()

    const win = getMainWindow()
    if (win) {
      win.webContents.send(IPC_EVENTS.systemLockScreen)
    }
  })
}
