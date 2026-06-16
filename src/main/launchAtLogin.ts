import { app } from 'electron'
import { isScreenshotMode } from './screenshotMode'

export function syncLaunchAtLogin(enabled: boolean): void {
  if (isScreenshotMode() || !app.isPackaged) return

  app.setLoginItemSettings({ openAtLogin: enabled })
}
