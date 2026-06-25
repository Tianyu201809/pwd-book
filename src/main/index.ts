import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'
import { consumeQuarantinedDatabasePath, initDatabase } from './db/database'
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
import {
  destroyQuickBar,
  registerQuickBarIpc,
  registerQuickBarShortcut,
  unregisterQuickBarShortcut,
} from './quickBar'
import {
  registerDetailWindowIpc,
} from './detailWindow'
import {
  registerMainWindowShortcut,
  unregisterMainWindowShortcut,
} from './mainWindowShortcut'
import {
  isScreenshotMode,
  prepareScreenshotEnvironment,
  runAnimalScreenshotCapture,
  setupScreenshotFixture,
} from './screenshotMode'
import { destroyBrowserBridge, syncBrowserBridge } from './services/browserBridgeService'
import { stopWifiSyncServer } from './services/wifiSyncService'
import { getSecuritySettings } from './services/settingsService'
import { registerSystemAutoLock } from './autoLock'
import { syncLaunchAtLogin } from './launchAtLogin'
import { IPC } from '../shared/types'

let mainWindow: BrowserWindow | null = null

if (isScreenshotMode()) {
  prepareScreenshotEnvironment()
}

const gotSingleInstanceLock = isScreenshotMode() ? true : app.requestSingleInstanceLock()

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
    const quarantinedDbPath = consumeQuarantinedDatabasePath()
    if (quarantinedDbPath) {
      void dialog.showMessageBox({
        type: 'warning',
        title: 'PwdBook',
        message: '本地数据库文件已损坏',
        detail:
          `检测到 pwdbook.db 不是有效的 SQLite 文件，已备份至：\n${quarantinedDbPath}\n\n` +
          '应用已创建新的空数据库。若您有文件夹同步备份（vault.pwdbook）或导出文件，可在解锁后通过导入/同步恢复数据。',
        buttons: ['我知道了'],
      })
    }
    if (isScreenshotMode()) {
      setupScreenshotFixture()
    }
    registerIpcHandlers()
    registerQuickBarIpc()
    registerDetailWindowIpc()
    registerQuickBarShortcut()
    registerMainWindowShortcut()
    registerSystemAutoLock()
    syncBrowserBridge()
    syncLaunchAtLogin(getSecuritySettings().launchAtLoginEnabled)

    ipcMain.on('window-minimize', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win && win !== mainWindow) {
        win.minimize()
        return
      }
      hideToTray()
    })
    ipcMain.on('window-maximize', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const target = win && win !== mainWindow ? win : mainWindow
      if (target?.isMaximized()) {
        target.unmaximize()
      } else {
        target?.maximize()
      }
    })
    ipcMain.on('window-close', (event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (win && win !== mainWindow) {
        win.close()
        return
      }
      requestQuit()
    })

    ipcMain.handle(IPC.windowGetAlwaysOnTop, (event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      return win?.isAlwaysOnTop() ?? false
    })

    ipcMain.handle(IPC.windowToggleAlwaysOnTop, (event) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return false
      const next = !win.isAlwaysOnTop()
      win.setAlwaysOnTop(next, 'floating')
      return next
    })

    ipcMain.on('theme-set-native', (_event, mode: 'dark' | 'light' | 'system') => {
      nativeTheme.themeSource = mode
    })

    createWindow()

    if (isScreenshotMode() && mainWindow) {
      mainWindow.webContents.once('did-finish-load', () => {
        void (async () => {
          await new Promise((resolve) => setTimeout(resolve, 1200))
          await runAnimalScreenshotCapture(mainWindow!)
          app.exit(0)
        })()
      })
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      } else {
        showFromTray()
      }
    })
  }).catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error)
    void dialog
      .showMessageBox({
        type: 'error',
        title: 'PwdBook',
        message: '启动失败',
        detail: `数据库初始化失败：${detail}`,
        buttons: ['退出'],
      })
      .finally(() => {
        app.quit()
      })
  })

  app.on('window-all-closed', () => {
    if (!getIsQuitting()) return
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('before-quit', () => {
    unregisterQuickBarShortcut()
    unregisterMainWindowShortcut()
    destroyQuickBar()
    destroyTray()
    destroyBrowserBridge()
    void stopWifiSyncServer()
  })
}
