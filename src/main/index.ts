import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { initDatabase } from './db/database'
import { registerIpcHandlers } from './ipc/handlers'
import {
  destroyTray,
  getIsQuitting,
  handleWindowClose,
  hideToTray,
  requestQuit,
  setMainWindow,
  showFromTray,
} from './tray'

let mainWindow: BrowserWindow | null = null

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
}

function resolveIconPath(): string | undefined {
  const candidates = app.isPackaged
    ? [join(process.resourcesPath, 'icon.png')]
    : [
        join(__dirname, '../../icon/icon.png'),
        join(process.cwd(), 'icon/icon.png'),
      ]
  return candidates.find((candidate) => existsSync(candidate))
}

function createWindow(): void {
  const iconPath = resolveIconPath()

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    show: false,
    frame: false,
    backgroundColor: '#0a0c10',
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => handleWindowClose(event))

  setMainWindow(mainWindow)

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function notifyAlreadyRunning(): void {
  showFromTray()
  const parent =
    mainWindow && !mainWindow.isDestroyed()
      ? mainWindow
      : BrowserWindow.getFocusedWindow() ?? undefined
  const dialogOptions: Electron.MessageBoxOptions = {
    type: 'info',
    title: 'PwdBook',
    message: 'PwdBook 已在运行中',
    detail: '程序已在运行，已为您打开现有窗口。请勿重复启动。',
    buttons: ['确定'],
    noLink: true,
  }
  if (parent) {
    void dialog.showMessageBox(parent, dialogOptions)
  } else {
    void dialog.showMessageBox(dialogOptions)
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:already-running')
  }
}

if (gotSingleInstanceLock) {
  app.on('second-instance', () => {
    notifyAlreadyRunning()
  })

  app.whenReady().then(async () => {
    await initDatabase()
    registerIpcHandlers()

    ipcMain.on('window-minimize', () => hideToTray())
    ipcMain.on('window-maximize', () => {
      if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow?.maximize()
      }
    })
    ipcMain.on('window-close', () => requestQuit())

    ipcMain.on('theme-set-native', (_event, mode: 'dark' | 'light' | 'system') => {
      nativeTheme.themeSource = mode
    })

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      } else {
        showFromTray()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (!getIsQuitting()) return
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    destroyTray()
  })
}
