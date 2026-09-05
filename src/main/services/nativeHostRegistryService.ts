import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { app, shell } from 'electron'
import { appError, ErrorCode } from '../../shared/errors'
import { getSetting, setSetting } from '../db/helpers'
import type { NativeHostRegistrationInfo } from '../../shared/browserBridgeProtocol'

const SETTINGS_KEY_EXTENSION_ID = 'browser_extension_id'
const HOST_NAME = 'com.pwdbook.app'

const EXTENSION_ID_RE = /^[a-p]{32}$/

export function getSavedExtensionId(): string {
  return getSetting(SETTINGS_KEY_EXTENSION_ID)?.trim().toLowerCase() ?? ''
}

function resolveBundledNativeHostDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'native-host')
  }
  return path.join(app.getAppPath(), 'native-host')
}

export function resolveBundledExtensionDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'extension')
  }
  return path.join(app.getAppPath(), 'extension')
}

function resolveResourcesDir(): string {
  if (app.isPackaged) {
    return process.resourcesPath
  }
  return app.getAppPath()
}

export async function openBundledExtensionDir(): Promise<void> {
  const dir = resolveResourcesDir()
  if (!fs.existsSync(dir)) {
    throw appError(ErrorCode.EXTENSION_DIR_NOT_FOUND)
  }
  const errorMessage = await shell.openPath(dir)
  if (errorMessage) {
    throw appError(ErrorCode.EXTENSION_DIR_OPEN_FAILED)
  }
}

export function getUserNativeHostDir(): string {
  return path.join(app.getPath('userData'), 'native-host')
}

export function getUserManifestPath(): string {
  return path.join(getUserNativeHostDir(), `${HOST_NAME}.json`)
}

function resolveHostEntryPath(hostDir: string): string {
  if (process.platform === 'win32') {
    return path.join(hostDir, 'pwdbook-native-host.cmd')
  }
  if (process.platform === 'darwin') {
    return path.join(hostDir, 'pwdbook-native-host.sh')
  }
  return ''
}

function readExtensionIdFromManifest(manifestPath: string): string {
  if (!fs.existsSync(manifestPath)) return ''
  try {
    const json = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      allowed_origins?: string[]
    }
    const origin = json.allowed_origins?.[0]
    if (typeof origin !== 'string') return ''
    const match = origin.match(/^chrome-extension:\/\/([a-p]{32})\/$/)
    return match?.[1] ?? ''
  } catch {
    return ''
  }
}

export function getNativeHostRegistrationInfo(): NativeHostRegistrationInfo {
  const manifestPath = getUserManifestPath()
  const hostDir = resolveBundledNativeHostDir()
  const hostEntryPath = resolveHostEntryPath(hostDir)
  const hostCmdExists = Boolean(hostEntryPath && fs.existsSync(hostEntryPath))
  const manifestExists = fs.existsSync(manifestPath)
  const fromManifest = readExtensionIdFromManifest(manifestPath)
  const fromSettings = getSavedExtensionId()
  const extensionId = fromSettings || fromManifest

  return {
    extensionId,
    registered: manifestExists && Boolean(extensionId) && hostCmdExists,
    manifestPath: manifestExists ? manifestPath : '',
    hostCmdPath: hostCmdExists ? hostEntryPath : '',
    hostCmdExists,
  }
}

function registerNativeHostWindows(id: string, hostEntryPath: string, manifestPath: string): void {
  const manifest = {
    name: HOST_NAME,
    description: 'PwdBook Native Messaging Host',
    path: hostEntryPath.replace(/\//g, '\\'),
    type: 'stdio',
    allowed_origins: [`chrome-extension://${id}/`],
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  const regValue = manifestPath.replace(/\//g, '\\')
  const registryKeys = [
    `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`,
    `HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${HOST_NAME}`,
  ]

  try {
    for (const key of registryKeys) {
      execSync(`reg add "${key}" /ve /t REG_SZ /d "${regValue}" /f`, { encoding: 'utf8' })
    }
  } catch {
    throw appError(ErrorCode.NATIVE_HOST_REGISTRY_FAILED)
  }
}

function registerNativeHostMac(id: string, hostEntryPath: string, manifestPath: string): void {
  try {
    fs.chmodSync(hostEntryPath, 0o755)
  } catch {
    /* ignore chmod errors on dev FS */
  }

  const manifest = {
    name: HOST_NAME,
    description: 'PwdBook Native Messaging Host',
    path: hostEntryPath,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${id}/`],
  }

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  const home = app.getPath('home')
  const browserDirs = [
    path.join(home, 'Library/Application Support/Google/Chrome/NativeMessagingHosts'),
    path.join(home, 'Library/Application Support/Microsoft Edge/NativeMessagingHosts'),
    path.join(home, 'Library/Application Support/Chromium/NativeMessagingHosts'),
  ]

  try {
    for (const dir of browserDirs) {
      fs.mkdirSync(dir, { recursive: true })
      const target = path.join(dir, `${HOST_NAME}.json`)
      fs.writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    }
  } catch {
    throw appError(ErrorCode.NATIVE_HOST_REGISTRY_FAILED)
  }
}

export function registerNativeHost(extensionId: string): NativeHostRegistrationInfo {
  const id = extensionId.trim().toLowerCase()
  if (!EXTENSION_ID_RE.test(id)) {
    throw appError(ErrorCode.INVALID_EXTENSION_ID)
  }
  if (process.platform !== 'win32' && process.platform !== 'darwin') {
    throw appError(ErrorCode.PLATFORM_UNSUPPORTED)
  }

  const hostDir = resolveBundledNativeHostDir()
  const hostEntryPath = resolveHostEntryPath(hostDir)
  if (!hostEntryPath || !fs.existsSync(hostEntryPath)) {
    throw appError(ErrorCode.NATIVE_HOST_NOT_FOUND)
  }

  const manifestDir = getUserNativeHostDir()
  fs.mkdirSync(manifestDir, { recursive: true })
  const manifestPath = getUserManifestPath()

  if (process.platform === 'win32') {
    registerNativeHostWindows(id, hostEntryPath, manifestPath)
  } else {
    registerNativeHostMac(id, hostEntryPath, manifestPath)
  }

  setSetting(SETTINGS_KEY_EXTENSION_ID, id)
  return getNativeHostRegistrationInfo()
}
