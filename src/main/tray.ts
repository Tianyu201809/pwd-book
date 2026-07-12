import { app, type BrowserWindow, Menu, Tray, nativeImage } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { getSetting } from './db/helpers'
import { getSecuritySettings } from './services/settingsService'
import { showQuickBar } from './quickBar'
import { getTrayLabels, UI_LOCALE_SETTING_KEY, type TrayLocale } from '../shared/trayLabels'
import { IPC_EVENTS } from '../shared/types'

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let isQuitting = false

export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

export function getIsQuitting(): boolean {
  return isQuitting
}

/** 标记即将退出，使窗口 close 不再 preventDefault（Cmd+Q / Dock 退出必需）。 */
export function markQuitting(): void {
  isQuitting = true
}

export function requestQuit(): void {
  markQuitting()
  destroyTray()
  app.quit()
}

function readTrayLocale(): TrayLocale {
  const stored = getSetting(UI_LOCALE_SETTING_KEY)
  return stored === 'en' ? 'en' : 'zh-CN'
}

function resolveTrayIconPath(): string | undefined {
  const candidates = app.isPackaged
    ? [
        join(process.resourcesPath, 'icon.ico'),
        join(process.resourcesPath, 'icon.png'),
      ]
    : [
        join(process.cwd(), 'icon/icon.ico'),
        join(__dirname, '../../icon/icon.ico'),
        join(process.cwd(), 'icon/icon.png'),
        join(__dirname, '../../icon/icon.png'),
      ]
  return candidates.find((candidate) => existsSync(candidate))
}

function buildTrayImage(): Electron.NativeImage | null {
  const iconPath = resolveTrayIconPath()
  if (!iconPath) return null

  const image = nativeImage.createFromPath(iconPath)
  if (image.isEmpty()) return null

  if (process.platform === 'win32') {
    return image.resize({ width: 16, height: 16 })
  }
  return image
}

export function rebuildTrayMenu(): void {
  if (!tray) return

  const labels = getTrayLabels(readTrayLocale())
  const quickBarEnabled = getSecuritySettings().quickBarEnabled
  const contextMenu = Menu.buildFromTemplate([
    { label: labels.showMain, click: () => showFromTray() },
    ...(quickBarEnabled
      ? [{ label: labels.quickSearch, click: () => showQuickBar() } as Electron.MenuItemConstructorOptions]
      : []),
    { label: labels.settings, click: () => openSettingsFromTray() },
    { type: 'separator' },
    { label: labels.quit, click: () => requestQuit() },
  ])
  tray.setContextMenu(contextMenu)
}

function ensureTray(): void {
  if (tray) {
    rebuildTrayMenu()
    return
  }

  const image = buildTrayImage()
  if (!image) return

  tray = new Tray(image)
  tray.setToolTip('PwdBook')
  rebuildTrayMenu()
  tray.on('click', () => showFromTray())
}

export function hideToTray(): void {
  if (!mainWindow) return
  ensureTray()
  mainWindow.hide()
}

export function showFromTray(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
}

export function openSettingsFromTray(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  showFromTray()
  mainWindow.webContents.send(IPC_EVENTS.trayOpenSettings)
}

/** 显示主窗口并通知渲染进程定位到指定条目（快捷条网站条目）。 */
export function focusEntryFromQuickBar(entryId: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (typeof entryId !== 'string' || !entryId.trim()) return
  showFromTray()
  mainWindow.webContents.send(IPC_EVENTS.quickBarFocusEntry, entryId.trim())
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}

function promptCloseDialog(): void {
  if (!mainWindow) return
  showFromTray()
  mainWindow.webContents.send('window:prompt-close')
}

export function handleWindowClose(event: Electron.Event): void {
  if (isQuitting) return
  event.preventDefault()

  const { closeWindowAction } = getSecuritySettings()
  if (closeWindowAction === 'quit') {
    requestQuit()
    return
  }
  if (closeWindowAction === 'tray') {
    hideToTray()
    return
  }
  promptCloseDialog()
}
