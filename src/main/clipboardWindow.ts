import { BrowserWindow, globalShortcut, ipcMain, screen } from 'electron'
import { join } from 'path'
import { IPC_EVENTS } from '../shared/types'
import { isUnlocked } from './services/sessionService'
import { showFromTray } from './tray'

const CLIPBOARD_WINDOW_WIDTH = 760
const CLIPBOARD_WINDOW_HEIGHT = 680
const CLIPBOARD_WINDOW_MIN_WIDTH = 560
const CLIPBOARD_WINDOW_MIN_HEIGHT = 480
const CLIPBOARD_WINDOW_TOP_OFFSET = 58
const CLIPBOARD_ACCELERATOR = 'Alt+Shift+O'
const CLIPBOARD_WINDOW_PINNED_GET = 'clipboard-window:get-pinned'
const CLIPBOARD_WINDOW_PINNED_TOGGLE = 'clipboard-window:toggle-pinned'

let clipboardWindow: BrowserWindow | null = null
let registeredAccelerator: string | null = null
let clipboardWindowPinned = false

function clipboardWindowUrl(): string {
  if (process.env.ELECTRON_RENDERER_URL) return `${process.env.ELECTRON_RENDERER_URL}/clipboard-window.html`
  return join(__dirname, '../renderer/clipboard-window.html')
}

function clipboardBounds(): Electron.Rectangle {
  const { x, y, width } = screen.getPrimaryDisplay().workArea
  return {
    x: Math.round(x + (width - CLIPBOARD_WINDOW_WIDTH) / 2),
    y: y + CLIPBOARD_WINDOW_TOP_OFFSET,
    width: CLIPBOARD_WINDOW_WIDTH,
    height: CLIPBOARD_WINDOW_HEIGHT,
  }
}

function createClipboardWindow(): BrowserWindow {
  const win = new BrowserWindow({
    ...clipboardBounds(),
    show: false,
    frame: false,
    resizable: true,
    transparent: true,
    minWidth: CLIPBOARD_WINDOW_MIN_WIDTH,
    minHeight: CLIPBOARD_WINDOW_MIN_HEIGHT,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  const url = clipboardWindowUrl()
  if (url.startsWith('http')) void win.loadURL(url)
  else void win.loadFile(url)
  win.on('blur', () => {
    if (!win.isDestroyed() && !clipboardWindowPinned) win.hide()
  })
  return win
}

function ensureClipboardWindow(): BrowserWindow {
  if (clipboardWindow && !clipboardWindow.isDestroyed()) return clipboardWindow
  clipboardWindow = createClipboardWindow()
  return clipboardWindow
}

export function hideClipboardWindow(): void {
  if (clipboardWindow && !clipboardWindow.isDestroyed()) clipboardWindow.hide()
}

export function showClipboardWindow(): void {
  if (!isUnlocked()) {
    showFromTray()
    return
  }
  const win = ensureClipboardWindow()
  if (win.isMinimized()) win.restore()
  if (!win.isVisible()) win.show()
  win.focus()
  win.webContents.send(IPC_EVENTS.themeChanged)
  win.webContents.send(IPC_EVENTS.clipboardWindowShown)
}

export function toggleClipboardWindow(): void {
  if (clipboardWindow && !clipboardWindow.isDestroyed() && clipboardWindow.isVisible()) {
    hideClipboardWindow()
    return
  }
  showClipboardWindow()
}

export function destroyClipboardWindow(): void {
  hideClipboardWindow()
  if (clipboardWindow && !clipboardWindow.isDestroyed()) clipboardWindow.destroy()
  clipboardWindow = null
  clipboardWindowPinned = false
}

export function hideClipboardWindowOnLock(): void {
  hideClipboardWindow()
}

export function unregisterClipboardWindowShortcut(): void {
  if (registeredAccelerator) {
    globalShortcut.unregister(registeredAccelerator)
    registeredAccelerator = null
  }
}

export function registerClipboardWindowShortcut(): void {
  unregisterClipboardWindowShortcut()
  if (globalShortcut.register(CLIPBOARD_ACCELERATOR, toggleClipboardWindow)) {
    registeredAccelerator = CLIPBOARD_ACCELERATOR
  }
}

export function notifyClipboardWindowThemeSync(): void {
  if (clipboardWindow && !clipboardWindow.isDestroyed()) clipboardWindow.webContents.send(IPC_EVENTS.themeChanged)
}

export function registerClipboardWindowIpc(): void {
  ipcMain.on('clipboard-window:hide', hideClipboardWindow)
  ipcMain.on('clipboard-window:show', showClipboardWindow)
  ipcMain.on('theme:notify-change', notifyClipboardWindowThemeSync)
  ipcMain.handle(CLIPBOARD_WINDOW_PINNED_GET, () => clipboardWindowPinned)
  ipcMain.handle(CLIPBOARD_WINDOW_PINNED_TOGGLE, () => {
    clipboardWindowPinned = !clipboardWindowPinned
    return clipboardWindowPinned
  })
}
