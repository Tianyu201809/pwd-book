import { BrowserWindow, globalShortcut, ipcMain, screen } from 'electron'
import { join } from 'path'
import { IPC_EVENTS } from '../shared/types'
import { getSecuritySettings } from './services/settingsService'
import { isUnlocked } from './services/sessionService'
import { showFromTray } from './tray'

const QUICK_BAR_WIDTH = 560
const QUICK_BAR_COLLAPSED_HEIGHT = 52
const QUICK_BAR_TOP_OFFSET = 28

let quickBarWindow: BrowserWindow | null = null
let registeredAccelerator: string | null = null

function quickBarUrl(): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/quickbar.html`
  }
  return join(__dirname, '../renderer/quickbar.html')
}

function centerQuickBarBounds(height: number): Electron.Rectangle {
  const display = screen.getPrimaryDisplay()
  const { x, y, width } = display.workArea
  return {
    x: Math.round(x + (width - QUICK_BAR_WIDTH) / 2),
    y: y + QUICK_BAR_TOP_OFFSET,
    width: QUICK_BAR_WIDTH,
    height,
  }
}

function createQuickBarWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: QUICK_BAR_WIDTH,
    height: QUICK_BAR_COLLAPSED_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#0a0c10',
    focusable: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const url = quickBarUrl()
  if (url.startsWith('http')) {
    void win.loadURL(url)
  } else {
    void win.loadFile(url)
  }

  win.on('blur', () => {
    if (!win.isDestroyed() && win.isVisible()) {
      hideQuickBar()
    }
  })

  return win
}

function ensureQuickBarWindow(): BrowserWindow {
  if (quickBarWindow && !quickBarWindow.isDestroyed()) {
    return quickBarWindow
  }
  quickBarWindow = createQuickBarWindow()
  return quickBarWindow
}

export function hideQuickBar(): void {
  if (!quickBarWindow || quickBarWindow.isDestroyed()) return
  quickBarWindow.hide()
}

export function showQuickBar(): void {
  const settings = getSecuritySettings()
  if (!settings.quickBarEnabled) return

  if (!isUnlocked()) {
    showFromTray()
    return
  }

  const win = ensureQuickBarWindow()
  win.setBounds(centerQuickBarBounds(QUICK_BAR_COLLAPSED_HEIGHT))
  if (!win.isVisible()) {
    win.show()
  }
  win.focus()
  win.webContents.send(IPC_EVENTS.themeChanged)
  win.webContents.send(IPC_EVENTS.quickBarShown)
}

export function toggleQuickBar(): void {
  if (quickBarWindow && !quickBarWindow.isDestroyed() && quickBarWindow.isVisible()) {
    hideQuickBar()
    return
  }
  showQuickBar()
}

export function destroyQuickBar(): void {
  hideQuickBar()
  if (quickBarWindow && !quickBarWindow.isDestroyed()) {
    quickBarWindow.destroy()
  }
  quickBarWindow = null
}

export function hideQuickBarOnLock(): void {
  hideQuickBar()
}

export function unregisterQuickBarShortcut(): void {
  if (registeredAccelerator) {
    globalShortcut.unregister(registeredAccelerator)
    registeredAccelerator = null
  }
}

export function registerQuickBarShortcut(): void {
  const { quickBarEnabled, quickBarAccelerator } = getSecuritySettings()
  unregisterQuickBarShortcut()
  if (!quickBarEnabled) return
  const ok = globalShortcut.register(quickBarAccelerator, () => {
    toggleQuickBar()
  })
  if (ok) {
    registeredAccelerator = quickBarAccelerator
  }
}

export function notifyQuickBarThemeSync(): void {
  if (!quickBarWindow || quickBarWindow.isDestroyed()) return
  quickBarWindow.webContents.send(IPC_EVENTS.themeChanged)
}

export function registerQuickBarIpc(): void {
  ipcMain.on('quickbar:hide', () => hideQuickBar())
  ipcMain.on('quickbar:show', () => showQuickBar())
  ipcMain.on('quickbar:show-main', () => showFromTray())
  ipcMain.on('theme:notify-change', () => notifyQuickBarThemeSync())
  ipcMain.on('quickbar:set-background', (_event, color: string) => {
    if (!quickBarWindow || quickBarWindow.isDestroyed()) return
    if (typeof color === 'string' && color) {
      quickBarWindow.setBackgroundColor(color)
    }
  })
  ipcMain.on('quickbar:resize', (_event, height: number) => {
    if (!quickBarWindow || quickBarWindow.isDestroyed()) return
    const nextHeight = Math.max(
      QUICK_BAR_COLLAPSED_HEIGHT,
      Math.min(Math.round(height), 420),
    )
    const bounds = quickBarWindow.getBounds()
    quickBarWindow.setBounds({
      ...bounds,
      height: nextHeight,
    })
  })
}
