import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { CancellationToken, ProgressInfo, UpdateInfo } from 'electron-updater'
import { IPC_EVENTS, type UpdateStatus } from '../../shared/types'
const GITHUB_PROVIDER = {
  provider: 'github' as const,
  owner: 'Tianyu201809',
  repo: 'pwd-book',
  private: false,
}

let initialized = false
let checkPromise: Promise<UpdateStatus> | null = null
let downloadPromise: Promise<UpdateStatus> | null = null
let backgroundDownloadActive = false
let activeCancellationToken: CancellationToken | null = null

type UpdaterListener = (...args: any[]) => void
const updaterListeners: Array<readonly [string, UpdaterListener]> = []

function currentVersion(): string {
  try {
    return app.getVersion()
  } catch {
    return '0.0.0'
  }
}

let status: UpdateStatus = {
  state: 'idle',
  currentVersion: currentVersion(),
}

function isStableSemVer(version: unknown): version is string {
  return (
    typeof version === 'string' &&
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(
      version,
    )
  )
}

function compareStableVersions(left: string, right: string): number {
  const leftCore = left.split('+', 1)[0].split('.').map(Number)
  const rightCore = right.split('+', 1)[0].split('.').map(Number)
  for (let index = 0; index < 3; index += 1) {
    if (leftCore[index] !== rightCore[index]) {
      return leftCore[index] > rightCore[index] ? 1 : -1
    }
  }
  return 0
}

function isNewerStableVersion(version: unknown): version is string {
  return isStableSemVer(version) && isStableSemVer(currentVersion()) && compareStableVersions(version, currentVersion()) > 0
}

function normalizeReleaseNotes(notes: UpdateInfo['releaseNotes']): string | undefined {
  if (typeof notes === 'string') return notes
  if (!Array.isArray(notes)) return undefined
  const text = notes
    .map((item) => (item && typeof item.note === 'string' ? item.note : ''))
    .filter(Boolean)
    .join('\n\n')
  return text || undefined
}

function normalizeUpdateError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return 'Update check failed'
}

function emitStatus(next: Omit<UpdateStatus, 'currentVersion'>): UpdateStatus {
  status = { currentVersion: currentVersion(), ...next }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(IPC_EVENTS.updateStatusChanged, status)
    }
  }
  return status
}

function infoStatus(state: UpdateStatus['state'], info?: UpdateInfo): UpdateStatus {
  const next: Omit<UpdateStatus, 'currentVersion'> = { state }
  if (info && isStableSemVer(info.version)) {
    next.version = info.version
    next.releaseNotes = normalizeReleaseNotes(info.releaseNotes)
  }
  return emitStatus(next)
}

function addUpdaterListener(event: string, listener: UpdaterListener): void {
  ;(autoUpdater as unknown as { on: (event: string, listener: UpdaterListener) => void }).on(
    event,
    listener,
  )
  updaterListeners.push([event, listener])
}

function configureUpdater(): void {
  autoUpdater.setFeedURL(GITHUB_PROVIDER)
  autoUpdater.allowPrerelease = false
  autoUpdater.autoInstallOnAppQuit = false

  addUpdaterListener('checking-for-update', () => {
    emitStatus({ state: 'checking' })
  })
  addUpdaterListener('update-available', (info: UpdateInfo) => {
    if (!isNewerStableVersion(info.version)) {
      backgroundDownloadActive = false
      emitStatus({ state: 'not-available' })
      return
    }
    backgroundDownloadActive = autoUpdater.autoDownload
    infoStatus('available', info)
  })
  addUpdaterListener('update-not-available', () => {
    backgroundDownloadActive = false
    emitStatus({ state: 'not-available' })
  })
  addUpdaterListener('download-progress', (progress: ProgressInfo) => {
    emitStatus({
      state: 'downloading',
      version: status.version,
      releaseNotes: status.releaseNotes,
      progress: Math.max(0, Math.min(100, Number(progress.percent) || 0)),
    })
  })
  addUpdaterListener('update-downloaded', (info: UpdateInfo) => {
    if (!isNewerStableVersion(info.version)) {
      backgroundDownloadActive = false
      emitStatus({ state: 'not-available' })
      return
    }
    backgroundDownloadActive = false
    infoStatus('downloaded', info)
    status = { ...status, progress: 100 }
    emitStatus({
      state: 'downloaded',
      version: status.version,
      releaseNotes: status.releaseNotes,
      progress: 100,
    })
  })
  addUpdaterListener('error', (error: Error) => {
    backgroundDownloadActive = false
    emitStatus({ state: 'error', error: normalizeUpdateError(error) })
  })
}

export function initializeUpdateService(): void {
  if (initialized || !app.isPackaged || process.env.PWD_BOOK_SCREENSHOT === '1') return
  initialized = true
  configureUpdater()
}

export function destroyUpdateService(): void {
  if (backgroundDownloadActive) {
    activeCancellationToken?.cancel()
    ;(autoUpdater as unknown as { cancelDownload?: () => void }).cancelDownload?.()
  }
  activeCancellationToken = null
  backgroundDownloadActive = false
  for (const [event, listener] of updaterListeners) {
    ;(autoUpdater as unknown as { removeListener: (event: string, listener: UpdaterListener) => void }).removeListener(
      event,
      listener,
    )
  }
  updaterListeners.length = 0
  checkPromise = null
  downloadPromise = null
  initialized = false
}

export function getUpdateStatus(): UpdateStatus {
  return { ...status }
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  if (!initialized) return getUpdateStatus()
  if (checkPromise) return checkPromise

  autoUpdater.autoDownload = false
  checkPromise = autoUpdater
    .checkForUpdates()
    .then((result) => {
      activeCancellationToken = result?.cancellationToken ?? null
      return result
    })
    .then((result) => {
      const info = result?.updateInfo
      if (info && !isNewerStableVersion(info.version)) return emitStatus({ state: 'not-available' })
      if (info) return infoStatus('available', info)
      return getUpdateStatus()
    })
    .catch((error: unknown) => emitStatus({ state: 'error', error: normalizeUpdateError(error) }))
    .finally(() => {
      checkPromise = null
    })
  return checkPromise
}

export async function downloadUpdate(): Promise<UpdateStatus> {
  if (!initialized || !status.version) return getUpdateStatus()
  if (downloadPromise) return downloadPromise
  autoUpdater.autoDownload = false
  emitStatus({
    state: 'downloading',
    version: status.version,
    releaseNotes: status.releaseNotes,
    progress: status.progress ?? 0,
  })
  downloadPromise = autoUpdater
    .downloadUpdate()
    .then(() => getUpdateStatus())
    .catch((error: unknown) => emitStatus({ state: 'error', error: normalizeUpdateError(error) }))
    .finally(() => {
      downloadPromise = null
    })
  return downloadPromise
}

export function installUpdate(): void {
  if (status.state === 'downloaded') autoUpdater.quitAndInstall()
}
