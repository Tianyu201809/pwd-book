import { execFileSync } from 'node:child_process'
import { app } from 'electron'
import { isScreenshotMode } from './screenshotMode'

const WINDOWS_RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'

export function formatWindowsLoginCommand(exePath: string): string {
  if (exePath.includes('"')) {
    throw new Error('Invalid executable path for login item')
  }
  return `"${exePath}"`
}

export function isLaunchAtLoginAvailable(): boolean {
  return !isScreenshotMode() && app.isPackaged
}

function getLoginItemName(): string {
  return app.getName()
}

function syncWindowsLaunchAtLogin(enabled: boolean): void {
  const name = getLoginItemName()

  if (!enabled) {
    try {
      execFileSync('reg.exe', ['delete', WINDOWS_RUN_KEY, '/v', name, '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      })
    } catch {
      // Entry may already be absent.
    }
    app.setLoginItemSettings({ openAtLogin: false })
    return
  }

  const command = formatWindowsLoginCommand(process.execPath)
  execFileSync(
    'reg.exe',
    ['add', WINDOWS_RUN_KEY, '/v', name, '/t', 'REG_SZ', '/d', command, '/f'],
    { stdio: 'ignore', windowsHide: true },
  )
}

function syncDefaultLaunchAtLogin(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
  })
}

export function syncLaunchAtLogin(enabled: boolean): void {
  if (!isLaunchAtLoginAvailable()) return

  if (process.platform === 'win32') {
    syncWindowsLaunchAtLogin(enabled)
    return
  }

  syncDefaultLaunchAtLogin(enabled)
}
