import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class TestEmitter {
    private listeners = new Map<string, Set<(...args: any[]) => void>>()
    on(event: string, listener: (...args: any[]) => void): this {
      const listeners = this.listeners.get(event) ?? new Set()
      listeners.add(listener)
      this.listeners.set(event, listeners)
      return this
    }
    removeListener(event: string, listener: (...args: any[]) => void): this {
      this.listeners.get(event)?.delete(listener)
      return this
    }
    removeAllListeners(): this {
      this.listeners.clear()
      return this
    }
    emit(event: string, ...args: any[]): boolean {
      for (const listener of this.listeners.get(event) ?? []) listener(...args)
      return true
    }
  }
  const updater = new TestEmitter() as TestEmitter & {
    autoDownload: boolean
    autoInstallOnAppQuit: boolean
    allowPrerelease: boolean
    setFeedURL: ReturnType<typeof vi.fn>
    checkForUpdates: ReturnType<typeof vi.fn>
    downloadUpdate: ReturnType<typeof vi.fn>
    cancelDownload: ReturnType<typeof vi.fn>
    quitAndInstall: ReturnType<typeof vi.fn>
  }
  updater.autoDownload = true
  updater.autoInstallOnAppQuit = true
  updater.allowPrerelease = true
  updater.setFeedURL = vi.fn()
  updater.checkForUpdates = vi.fn()
  updater.downloadUpdate = vi.fn()
  updater.cancelDownload = vi.fn()
  updater.quitAndInstall = vi.fn()
  return {
    updater,
    app: {
      isPackaged: false,
      getVersion: vi.fn(() => '1.42.0'),
    },
    settings: { autoUpdateEnabled: true },
  }
})

vi.mock('electron', () => ({
  app: mocks.app,
  BrowserWindow: { getAllWindows: vi.fn(() => []) },
}))

vi.mock('electron-updater', () => ({ autoUpdater: mocks.updater }))
vi.mock('./settingsService', () => ({
  getSecuritySettings: vi.fn(() => ({ autoUpdateEnabled: mocks.settings.autoUpdateEnabled })),
}))

import {
  checkForUpdates,
  destroyUpdateService,
  downloadUpdate,
  getUpdateStatus,
  initializeUpdateService,
  installUpdate,
  setAutoUpdateEnabled,
} from './updateService'

const stableInfo = {
  version: '1.43.0',
  releaseNotes: 'Bug fixes',
  files: [],
  path: '',
  sha512: '',
  releaseDate: '2026-09-29T00:00:00.000Z',
}

describe('updateService', () => {
  beforeEach(() => {
    destroyUpdateService()
    mocks.updater.removeAllListeners()
    mocks.updater.autoDownload = true
    mocks.updater.autoInstallOnAppQuit = true
    mocks.updater.checkForUpdates.mockReset()
    mocks.updater.downloadUpdate.mockReset()
    mocks.updater.cancelDownload.mockReset()
    mocks.updater.quitAndInstall.mockReset()
    mocks.updater.setFeedURL.mockReset()
    mocks.app.isPackaged = false
    mocks.settings.autoUpdateEnabled = true
  })

  it('does not initialize network update checks when app is not packaged', async () => {
    initializeUpdateService()
    await checkForUpdates()
    expect(mocks.updater.setFeedURL).not.toHaveBeenCalled()
    expect(mocks.updater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('rejects prerelease update info and reports not-available', async () => {
    mocks.app.isPackaged = true
    mocks.settings.autoUpdateEnabled = false
    mocks.updater.checkForUpdates.mockResolvedValue({
      updateInfo: { ...stableInfo, version: '1.43.0-beta.1' },
    })
    initializeUpdateService()
    const result = await checkForUpdates(true)
    expect(result.state).toBe('not-available')
  })

  it('automatically downloads a stable update when the preference is enabled', async () => {
    mocks.app.isPackaged = true
    mocks.updater.checkForUpdates.mockResolvedValue({ updateInfo: stableInfo })
    initializeUpdateService()
    await checkForUpdates(false)
    expect(mocks.updater.autoDownload).toBe(true)
    expect(getUpdateStatus()).toMatchObject({ state: 'available', version: '1.43.0' })
  })

  it('uses manual download when the preference is disabled', async () => {
    mocks.app.isPackaged = true
    mocks.settings.autoUpdateEnabled = false
    mocks.updater.checkForUpdates.mockResolvedValue({ updateInfo: stableInfo })
    mocks.updater.downloadUpdate.mockResolvedValue([])
    initializeUpdateService()
    await checkForUpdates(true)
    expect(mocks.updater.autoDownload).toBe(false)
    await downloadUpdate()
    expect(mocks.updater.downloadUpdate).toHaveBeenCalledTimes(1)
  })

  it('cancels an active background download when automatic updates are disabled', async () => {
    mocks.app.isPackaged = true
    mocks.updater.checkForUpdates.mockResolvedValue({ updateInfo: stableInfo })
    initializeUpdateService()
    await checkForUpdates(false)
    mocks.updater.emit('update-available', stableInfo)
    setAutoUpdateEnabled(false)
    expect(mocks.updater.cancelDownload).toHaveBeenCalledTimes(1)
  })

  it('maps download progress and downloaded events to stable status', async () => {
    mocks.app.isPackaged = true
    mocks.settings.autoUpdateEnabled = false
    mocks.updater.checkForUpdates.mockResolvedValue({ updateInfo: stableInfo })
    initializeUpdateService()
    await checkForUpdates(true)
    mocks.updater.emit('download-progress', { percent: 42 })
    expect(getUpdateStatus()).toMatchObject({ state: 'downloading', progress: 42 })
    mocks.updater.emit('update-downloaded', stableInfo)
    expect(getUpdateStatus()).toMatchObject({ state: 'downloaded', progress: 100 })
    installUpdate()
    expect(mocks.updater.quitAndInstall).toHaveBeenCalledTimes(1)
  })
})
