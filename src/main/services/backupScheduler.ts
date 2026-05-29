import { getMainWindow } from '../tray'
import { getStoredFrequency, isScheduledBackupDue } from './emailBackupService'
import { isUnlocked } from './sessionService'
import { IPC_EVENTS } from '../../shared/types'

const CHECK_INTERVAL_MS = 60 * 60 * 1000

let timer: NodeJS.Timeout | null = null
let notifiedThisSession = false

function notifyScheduledBackupDue(): void {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  win.webContents.send(IPC_EVENTS.scheduledBackupDue)
}

export function checkScheduledBackupDue(force = false): void {
  if (!isUnlocked()) return
  if (getStoredFrequency() === 'manual') return
  if (!isScheduledBackupDue()) return
  if (!force && notifiedThisSession) return

  notifiedThisSession = true
  notifyScheduledBackupDue()
}

export function resetScheduledBackupNotification(): void {
  notifiedThisSession = false
}

export function startBackupScheduler(): void {
  if (timer) return
  timer = setInterval(() => {
    checkScheduledBackupDue()
  }, CHECK_INTERVAL_MS)
}

export function stopBackupScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
