import { randomUUID } from 'crypto'
import fs from 'fs'
import net from 'net'
import path from 'path'
import { app } from 'electron'
import type {
  BridgeCredentialData,
  BridgeRequest,
  BridgeResponse,
  BridgeStatusData,
  BrowserBridgeStatus,
} from '../../shared/browserBridgeProtocol'
import { ErrorCode } from '../../shared/errors'
import { entryUrlMatchesPage } from '../../shared/urlMatch'
import { matchLoginsForPage } from './browserMatchService'
import { getSecuritySettings } from './settingsService'
import { isUnlocked } from './sessionService'
import { getEntryById, getVaultStatus, touchEntry } from './vaultService'

const BRIDGE_VERSION = '1.0.0'

let server: net.Server | null = null
let bridgeToken: string | null = null
let bridgePort: number | null = null

export function getBridgeConfigPath(): string {
  return path.join(app.getPath('userData'), 'native-bridge.json')
}

function bridgeConfigWritePaths(): string[] {
  const paths = [getBridgeConfigPath()]
  const appData = process.env.APPDATA
  if (appData) {
    const legacy = path.join(appData, 'PwdBook', 'native-bridge.json')
    if (!paths.includes(legacy)) paths.push(legacy)
  }
  return paths
}

function writeBridgeConfig(): void {
  if (!bridgePort || !bridgeToken) return
  const payload = JSON.stringify({
    host: '127.0.0.1',
    port: bridgePort,
    token: bridgeToken,
    version: 1,
  })
  for (const configPath of bridgeConfigWritePaths()) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true })
    fs.writeFileSync(configPath, payload, { encoding: 'utf8', mode: 0o600 })
  }
}

function removeBridgeConfig(): void {
  for (const configPath of bridgeConfigWritePaths()) {
    try {
      fs.unlinkSync(configPath)
    } catch {
      /* ignore */
    }
  }
}

function handleBridgeRequest(req: BridgeRequest): BridgeResponse {
  if (!getSecuritySettings().browserFillEnabled) {
    return { ok: false, error: ErrorCode.BROWSER_BRIDGE_DISABLED }
  }
  if (!bridgeToken || req.token !== bridgeToken) {
    return { ok: false, error: ErrorCode.BROWSER_BRIDGE_UNAUTHORIZED }
  }

  switch (req.action) {
    case 'ping':
      return { ok: true, data: { version: BRIDGE_VERSION } }
    case 'status': {
      const status = getVaultStatus()
      const data: BridgeStatusData = {
        unlocked: status.unlocked,
        entryCount: status.entryCount,
      }
      return { ok: true, data }
    }
    case 'matchLogins': {
      if (!isUnlocked()) {
        return { ok: false, error: ErrorCode.VAULT_LOCKED }
      }
      const pageUrl = req.pageUrl?.trim() ?? ''
      if (!pageUrl) {
        return { ok: false, error: ErrorCode.INVALID_PAGE_URL }
      }
      return { ok: true, data: { matches: matchLoginsForPage(pageUrl) } }
    }
    case 'getCredential': {
      if (!isUnlocked()) {
        return { ok: false, error: ErrorCode.VAULT_LOCKED }
      }
      const pageUrl = req.pageUrl?.trim() ?? ''
      const entryId = req.entryId?.trim() ?? ''
      if (!pageUrl || !entryId) {
        return { ok: false, error: ErrorCode.INVALID_PAGE_URL }
      }
      const entry = getEntryById(entryId)
      if (!entry) {
        return { ok: false, error: ErrorCode.ENTRY_NOT_FOUND }
      }
      if (!entryUrlMatchesPage(entry.url, pageUrl)) {
        return { ok: false, error: ErrorCode.BROWSER_URL_MISMATCH }
      }
      touchEntry(entryId)
      const data: BridgeCredentialData = {
        username: entry.username,
        password: entry.password,
      }
      return { ok: true, data }
    }
    default:
      return { ok: false, error: ErrorCode.OPERATION_FAILED }
  }
}

function handleSocketLine(line: string): string {
  try {
    const req = JSON.parse(line) as BridgeRequest
    const res = handleBridgeRequest(req)
    return `${JSON.stringify(res)}\n`
  } catch {
    return `${JSON.stringify({ ok: false, error: ErrorCode.OPERATION_FAILED })}\n`
  }
}

/** Native Host 每次请求后立即断开；须吞掉 ECONNRESET/EPIPE，避免拖垮主进程 */
function isBenignSocketError(err: NodeJS.ErrnoException): boolean {
  return err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.code === 'ECANCELED'
}

function replyAndClose(socket: net.Socket, payload: string): void {
  if (socket.destroyed) return
  socket.write(payload, (writeErr) => {
    if (writeErr && !isBenignSocketError(writeErr)) {
      socket.destroy()
      return
    }
    socket.end()
  })
}

export function startBrowserBridge(): void {
  if (server) return

  bridgeToken = randomUUID()
  server = net.createServer((socket) => {
    let buffer = ''
    socket.on('error', (err) => {
      if (!isBenignSocketError(err)) {
        socket.destroy()
      }
    })
    socket.on('data', (chunk) => {
      if (socket.destroyed) return
      buffer += chunk.toString('utf8')
      const newlineIndex = buffer.indexOf('\n')
      if (newlineIndex < 0) return
      const line = buffer.slice(0, newlineIndex).trim()
      if (line) {
        replyAndClose(socket, handleSocketLine(line))
      }
    })
  })

  server.on('error', (err) => {
    if (!isBenignSocketError(err)) {
      stopBrowserBridge()
      if (getSecuritySettings().browserFillEnabled) {
        startBrowserBridge()
      }
    }
  })

  server.listen(0, '127.0.0.1', () => {
    const address = server?.address()
    if (address && typeof address === 'object') {
      bridgePort = address.port
      writeBridgeConfig()
    }
  })
}

export function stopBrowserBridge(): void {
  if (server) {
    server.close()
    server = null
  }
  bridgeToken = null
  bridgePort = null
  removeBridgeConfig()
}

export function syncBrowserBridge(): void {
  if (getSecuritySettings().browserFillEnabled) {
    startBrowserBridge()
  } else {
    stopBrowserBridge()
  }
}

export function regenerateBrowserBridgeToken(): void {
  if (!getSecuritySettings().browserFillEnabled) return
  stopBrowserBridge()
  startBrowserBridge()
}

export function getBrowserBridgeStatus(): BrowserBridgeStatus {
  return {
    enabled: getSecuritySettings().browserFillEnabled,
    running: server !== null && bridgePort !== null,
    port: bridgePort,
    unlocked: isUnlocked(),
  }
}

export function destroyBrowserBridge(): void {
  stopBrowserBridge()
}
