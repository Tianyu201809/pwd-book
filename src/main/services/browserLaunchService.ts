import { clipboard } from 'electron'
import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { appError, ErrorCode } from '../../shared/errors'

export interface OpenBrowserExtensionsPageResult {
  copiedUrl: string
}

function getWindowsChromePaths(): string[] {
  const bases = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(
    Boolean,
  ) as string[]
  return bases.map((base) => path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'))
}

function getWindowsEdgePaths(): string[] {
  const bases = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(
    Boolean,
  ) as string[]
  return bases.map((base) => path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'))
}

function firstExisting(paths: string[]): string | null {
  for (const candidate of paths) {
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

function getWindowsDefaultBrowserProgId(): string | null {
  const result = spawnSync(
    'reg',
    [
      'query',
      'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice',
      '/v',
      'ProgId',
    ],
    { encoding: 'utf8', windowsHide: true },
  )
  if (result.status !== 0 || !result.stdout) return null
  const match = result.stdout.match(/ProgId\s+REG_SZ\s+(\S+)/)
  return match?.[1] ?? null
}

function resolveWindowsExtensionsUrl(): string {
  const hasChrome = !!firstExisting(getWindowsChromePaths())
  const hasEdge = !!firstExisting(getWindowsEdgePaths())
  const progId = getWindowsDefaultBrowserProgId()

  if (progId && /edge/i.test(progId) && hasEdge) return 'edge://extensions/'
  if (progId && /chrome/i.test(progId) && !/edge/i.test(progId) && hasChrome) return 'chrome://extensions/'
  if (hasChrome) return 'chrome://extensions/'
  if (hasEdge) return 'edge://extensions/'

  throw appError(ErrorCode.BROWSER_NOT_FOUND)
}

function resolveDarwinExtensionsUrl(): string {
  const apps = [
    { app: 'Google Chrome', url: 'chrome://extensions/' },
    { app: 'Microsoft Edge', url: 'edge://extensions/' },
    { app: 'Chromium', url: 'chrome://extensions/' },
  ]
  for (const target of apps) {
    const check = spawnSync('open', ['-Ra', target.app], { stdio: 'ignore' })
    if (check.status === 0) return target.url
  }
  throw appError(ErrorCode.BROWSER_NOT_FOUND)
}

function commandExists(command: string): boolean {
  const checker = process.platform === 'win32' ? 'where' : 'which'
  const result = spawnSync(checker, [command], { stdio: 'ignore' })
  return result.status === 0
}

function resolveLinuxExtensionsUrl(): string {
  const targets = [
    { cmd: 'google-chrome', url: 'chrome://extensions/' },
    { cmd: 'google-chrome-stable', url: 'chrome://extensions/' },
    { cmd: 'chromium', url: 'chrome://extensions/' },
    { cmd: 'chromium-browser', url: 'chrome://extensions/' },
    { cmd: 'microsoft-edge', url: 'edge://extensions/' },
    { cmd: 'microsoft-edge-stable', url: 'edge://extensions/' },
  ]
  for (const target of targets) {
    if (commandExists(target.cmd)) return target.url
  }
  throw appError(ErrorCode.BROWSER_NOT_FOUND)
}

function resolveExtensionsPageUrl(): string {
  if (process.platform === 'win32') return resolveWindowsExtensionsUrl()
  if (process.platform === 'darwin') return resolveDarwinExtensionsUrl()
  return resolveLinuxExtensionsUrl()
}

export async function openBrowserExtensionsPage(): Promise<OpenBrowserExtensionsPageResult> {
  const copiedUrl = resolveExtensionsPageUrl()
  clipboard.writeText(copiedUrl)
  return { copiedUrl }
}
