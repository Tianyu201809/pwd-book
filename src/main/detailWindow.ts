import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { IPC, IPC_EVENTS } from '../shared/types'
import { getMainWindow } from './tray'
import { isUnlocked } from './services/sessionService'

const DETAIL_WINDOW_WIDTH = 480
const DETAIL_WINDOW_HEIGHT = 720
const DETAIL_WINDOW_MIN_WIDTH = 400
const DETAIL_WINDOW_MIN_HEIGHT = 520

let detailWindow: BrowserWindow | null = null
let detailWindowReady = false
let pendingSelectEntryId: string | null = null

function detailWindowUrl(): string {
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/detail.html`
  }
  return join(__dirname, '../renderer/detail.html')
}

function createDetailWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: DETAIL_WINDOW_WIDTH,
    height: DETAIL_WINDOW_HEIGHT,
    minWidth: DETAIL_WINDOW_MIN_WIDTH,
    minHeight: DETAIL_WINDOW_MIN_HEIGHT,
    show: false,
    frame: false,
    backgroundColor: '#0a0c10',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const url = detailWindowUrl()
  if (url.startsWith('http')) {
    void win.loadURL(url)
  } else {
    void win.loadFile(url)
  }

  win.on('closed', () => {
    detailWindow = null
    detailWindowReady = false
    pendingSelectEntryId = null
    getMainWindow()?.webContents.send(IPC_EVENTS.detailWindowClosed)
  })

  return win
}

function ensureDetailWindow(): BrowserWindow {
  if (detailWindow && !detailWindow.isDestroyed()) {
    return detailWindow
  }
  detailWindow = createDetailWindow()
  detailWindowReady = false
  return detailWindow
}

function sendSelectEntry(entryId: string): void {
  if (!detailWindow || detailWindow.isDestroyed()) return
  detailWindow.webContents.send(IPC_EVENTS.detailWindowSelectEntry, entryId)
}

export function isDetailWindowOpen(): boolean {
  return detailWindow !== null && !detailWindow.isDestroyed()
}

export function openDetailWindow(entryId: string): boolean {
  if (!isUnlocked() || !entryId) return false

  pendingSelectEntryId = entryId
  const win = ensureDetailWindow()

  if (detailWindowReady) {
    sendSelectEntry(entryId)
    pendingSelectEntryId = null
  }

  if (!win.isVisible()) {
    win.show()
  }
  win.focus()
  win.webContents.send(IPC_EVENTS.themeChanged)
  getMainWindow()?.webContents.send(IPC_EVENTS.detailWindowOpened)
  return true
}

export function closeDetailWindow(): void {
  if (!detailWindow || detailWindow.isDestroyed()) return
  detailWindow.close()
}

export function hideDetailWindowOnLock(): void {
  closeDetailWindow()
}

export function notifyDetailWindowThemeSync(): void {
  if (!detailWindow || detailWindow.isDestroyed()) return
  detailWindow.webContents.send(IPC_EVENTS.themeChanged)
}

function broadcastVaultDataChanged(source: Electron.WebContents): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || win.webContents === source) continue
    win.webContents.send(IPC_EVENTS.vaultDataChanged)
  }
}

function isDetailWindowSender(contents: Electron.WebContents): boolean {
  return detailWindow !== null && !detailWindow.isDestroyed() && detailWindow.webContents === contents
}

export function registerDetailWindowIpc(): void {
  ipcMain.handle(IPC.detailWindowOpen, (_event, entryId: string) => openDetailWindow(entryId))

  ipcMain.on(IPC.detailWindowClose, () => closeDetailWindow())

  ipcMain.on(IPC.detailWindowReady, (event) => {
    detailWindowReady = true
    if (pendingSelectEntryId) {
      event.sender.send(IPC_EVENTS.detailWindowSelectEntry, pendingSelectEntryId)
      pendingSelectEntryId = null
    }
  })

  ipcMain.on(IPC.detailWindowSelectEntry, (event, entryId: string) => {
    const main = getMainWindow()
    if (!main || event.sender !== main.webContents) return
    if (!entryId || !isDetailWindowOpen()) return
    sendSelectEntry(entryId)
  })

  ipcMain.handle(IPC.detailWindowGetAlwaysOnTop, (event) => {
    if (!isDetailWindowSender(event.sender)) return false
    return detailWindow!.isAlwaysOnTop()
  })

  ipcMain.handle(IPC.detailWindowToggleAlwaysOnTop, (event) => {
    if (!isDetailWindowSender(event.sender)) return false
    const next = !detailWindow!.isAlwaysOnTop()
    detailWindow!.setAlwaysOnTop(next, 'floating')
    return next
  })

  ipcMain.on(IPC.vaultDataNotifyChanged, (event) => {
    broadcastVaultDataChanged(event.sender)
  })

  ipcMain.on('theme:notify-change', () => notifyDetailWindowThemeSync())
}
