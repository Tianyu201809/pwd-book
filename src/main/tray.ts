import { app, BrowserWindow, Menu, Tray, nativeImage } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { getSecuritySettings } from './services/settingsService'

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let isQuitting = false

export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win
}

export function getIsQuitting(): boolean {
  return isQuitting
}

export function requestQuit(): void {
  isQuitting = true
  destroyTray()
  app.quit()
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

function ensureTray(): void {
  if (tray) return

  const image = buildTrayImage()
  if (!image) return

  tray = new Tray(image)
  tray.setToolTip('PwdBook')

  const contextMenu = Menu.buildFromTemplate([
    { label: '显示主窗口', click: () => showFromTray() },
    { type: 'separator' },
    { label: '退出 PwdBook', click: () => requestQuit() },
  ])
  tray.setContextMenu(contextMenu)
  tray.on('click', () => showFromTray())
}

export function hideToTray(): void {
  if (!mainWindow) return
  ensureTray()
  mainWindow.hide()
}

export function showFromTray(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
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
