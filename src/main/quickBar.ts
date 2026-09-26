import { BrowserWindow, globalShortcut, ipcMain, screen } from 'electron'
import { join } from 'path'
import { DEFAULT_ACCELERATORS, normalizeAccelerator } from '../shared/globalAccelerator'
import { QUICK_BAR_RESULTS_MAX_HEIGHT_PX } from '../shared/quickBarLimits'
import { IPC_EVENTS } from '../shared/types'
import { getSecuritySettings } from './services/settingsService'
import { isUnlocked } from './services/sessionService'
import { focusEntryFromQuickBar, showFromTray } from './tray'

const QUICK_BAR_WIDTH = 560
const QUICK_BAR_DETAIL_WIDTH = 920
const QUICK_BAR_COLLAPSED_HEIGHT = 52
const QUICK_BAR_TOP_OFFSET = 28
/** 搜索条 + 分区标题 + 结果区 max-height，窗口不再随条目无限增高 */
const QUICK_BAR_MAX_HEIGHT = QUICK_BAR_COLLAPSED_HEIGHT + 40 + QUICK_BAR_RESULTS_MAX_HEIGHT_PX

let quickBarWindow: BrowserWindow | null = null
let registeredAccelerator: string | null = null

function quickBarUrl(): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/quickbar.html`
  }
  return join(__dirname, '../renderer/quickbar.html')
}

function centerQuickBarBounds(height: number, width = QUICK_BAR_WIDTH): Electron.Rectangle {
  const display = screen.getPrimaryDisplay()
  const { x, y, width: workAreaWidth } = display.workArea
  return {
    x: Math.round(x + (workAreaWidth - width) / 2),
    y: y + QUICK_BAR_TOP_OFFSET,
    width,
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

export function registerQuickBarShortcut(): boolean {
  const { quickBarEnabled, quickBarAccelerator } = getSecuritySettings()
  unregisterQuickBarShortcut()
  if (!quickBarEnabled) return true
  const accelerator = normalizeAccelerator(quickBarAccelerator) ?? DEFAULT_ACCELERATORS.quickBar
  try {
    const ok = globalShortcut.register(accelerator, () => {
      toggleQuickBar()
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

export function notifyQuickBarThemeSync(): void {
  if (!quickBarWindow || quickBarWindow.isDestroyed()) return
  quickBarWindow.webContents.send(IPC_EVENTS.themeChanged)
}

export function registerQuickBarIpc(): void {
  ipcMain.on('quickbar:hide', () => hideQuickBar())
  ipcMain.on('quickbar:show', () => showQuickBar())
  ipcMain.on('quickbar:show-main', () => showFromTray())
  ipcMain.on('quickbar:focus-entry', (_event, entryId: string) => {
    focusEntryFromQuickBar(entryId)
  })
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
      Math.min(Math.round(height), QUICK_BAR_MAX_HEIGHT),
    )
    const bounds = quickBarWindow.getBounds()
    quickBarWindow.setBounds({
      ...bounds,
      height: nextHeight,
    })
  })
  ipcMain.on('quickbar:set-detail-open', (_event, open: boolean) => {
    if (!quickBarWindow || quickBarWindow.isDestroyed()) return
    const bounds = quickBarWindow.getBounds()
    const width = open ? QUICK_BAR_DETAIL_WIDTH : QUICK_BAR_WIDTH
    quickBarWindow.setBounds(centerQuickBarBounds(bounds.height, width))
  })
}
