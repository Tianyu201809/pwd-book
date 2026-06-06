import { createHash, randomBytes } from 'crypto'
import fs from 'fs'
import http from 'http'
import https from 'https'
import os from 'os'
import path from 'path'
import { app } from 'electron'
import selfsigned from 'selfsigned'
import { Bonjour } from 'bonjour-service'
import { getSetting, setSetting } from '../db/helpers'
import type {
  WifiSyncDiscoveredServer,
  WifiSyncPairingInfo,
  WifiSyncServerStatus,
  WifiSyncSettings,
} from '../../shared/syncTypes'
import { SYNC_BUNDLE_FILENAME } from '../../shared/syncTypes'
import { SYNC_WEBDAV_PATH, SYNC_WEBDAV_USER } from '../../shared/syncClient'
import {
  getSyncBundlePath,
  getSyncServerDir,
  publishEncryptedBundle,
  readEncryptedBundleFromServer,
} from './syncBundleService'
import { isUnlocked } from './sessionService'
import { deriveSyncTransportKey } from '../crypto/vaultCrypto'
import { getSyncVerificationCode } from '../../shared/syncVerification'

const SETTINGS_KEY = 'wifi_sync_settings'
const SERVICE_TYPE = 'pwdbook-sync'
const DEFAULT_PORT = 8765
const CERT_DIR_NAME = 'wifi-sync-certs'

let httpServer: http.Server | https.Server | null = null
let bonjour: InstanceType<typeof Bonjour> | null = null
let publishedService: ReturnType<InstanceType<typeof Bonjour>['publish']> | null = null
let publishTimer: NodeJS.Timeout | null = null
let lastPublishedAt: number | null = null
let lastPublishedRevision = 0
let certificateFingerprint = ''
let tlsOptions: https.ServerOptions | null = null

function defaultSettings(): WifiSyncSettings {
  return {
    serverEnabled: false,
    accessPassword: randomBytes(12).toString('base64url'),
    port: DEFAULT_PORT,
    pairedDevices: [],
  }
}

function readSettings(): WifiSyncSettings {
  const raw = getSetting(SETTINGS_KEY)
  if (!raw) return defaultSettings()
  try {
    const parsed = JSON.parse(raw) as Partial<WifiSyncSettings>
    const defaults = defaultSettings()
    return {
      serverEnabled: parsed.serverEnabled ?? defaults.serverEnabled,
      accessPassword: parsed.accessPassword ?? defaults.accessPassword,
      port: parsed.port ?? defaults.port,
      pairedDevices: parsed.pairedDevices ?? defaults.pairedDevices,
    }
  } catch {
    return defaultSettings()
  }
}

function writeSettings(settings: WifiSyncSettings): void {
  setSetting(SETTINGS_KEY, JSON.stringify(settings))
}

export function getWifiSyncSettings(): WifiSyncSettings {
  return readSettings()
}

export function updateWifiSyncSettings(partial: Partial<WifiSyncSettings>): WifiSyncSettings {
  const next = { ...readSettings(), ...partial }
  writeSettings(next)
  return next
}

export function regenerateAccessPassword(): string {
  const password = randomBytes(12).toString('base64url')
  updateWifiSyncSettings({ accessPassword: password })
  return password
}

function getCertDir(): string {
  return path.join(app.getPath('userData'), CERT_DIR_NAME)
}

function ensureTlsMaterials(): https.ServerOptions {
  if (tlsOptions) return tlsOptions

  const certDir = getCertDir()
  fs.mkdirSync(certDir, { recursive: true })
  const keyPath = path.join(certDir, 'server.key')
  const certPath = path.join(certDir, 'server.crt')

  if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
    const attrs = [{ name: 'commonName', value: 'PwdBook Wi-Fi Sync' }]
    const generated = selfsigned.generate(attrs, {
      algorithm: 'sha256',
      days: 3650,
      keySize: 2048,
    })
    fs.writeFileSync(keyPath, generated.private, { mode: 0o600 })
    fs.writeFileSync(certPath, generated.cert, { mode: 0o600 })
  }

  const certPem = fs.readFileSync(certPath, 'utf8')
  certificateFingerprint = createHash('sha256').update(certPem).digest('hex').slice(0, 16).toUpperCase()

  tlsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  }
  return tlsOptions
}

export function getVerificationCode(fingerprint = certificateFingerprint): string {
  return getSyncVerificationCode(fingerprint)
}

function getLanHost(): string {
  const interfaces = os.networkInterfaces()
  for (const entries of Object.values(interfaces)) {
    if (!entries) continue
    for (const entry of entries) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address
      }
    }
  }
  return '127.0.0.1'
}

function parseBasicAuth(header: string | undefined): string | null {
  if (!header || !header.startsWith('Basic ')) return null
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
  const separator = decoded.indexOf(':')
  if (separator < 0) return null
  const user = decoded.slice(0, separator)
  const password = decoded.slice(separator + 1)
  if (user !== SYNC_WEBDAV_USER) return null
  return password
}

function unauthorized(res: http.ServerResponse): void {
  res.writeHead(401, {
    'WWW-Authenticate': 'Basic realm="PwdBook Wi-Fi Sync"',
    'Content-Type': 'text/plain; charset=utf-8',
  })
  res.end('Unauthorized')
}

function writeDavHeaders(res: http.ServerResponse, extra: Record<string, string> = {}): void {
  res.setHeader('DAV', '1,2')
  res.setHeader('Allow', 'GET, PUT, HEAD, OPTIONS, PROPFIND')
  Object.entries(extra).forEach(([key, value]) => res.setHeader(key, value))
}

function handleDavRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  accessPassword: string,
): void {
  const url = new URL(req.url ?? '/', `https://${req.headers.host ?? 'localhost'}`)
  const bundlePath = SYNC_WEBDAV_PATH
  const password = parseBasicAuth(req.headers.authorization)

  if (req.method === 'OPTIONS') {
    writeDavHeaders(res)
    res.writeHead(204)
    res.end()
    return
  }

  if (url.pathname !== bundlePath && url.pathname !== '/sync/') {
    res.writeHead(404)
    res.end('Not Found')
    return
  }

  if (password !== accessPassword) {
    unauthorized(res)
    return
  }

  if (req.method === 'PROPFIND') {
    const bundle = readEncryptedBundleFromServer()
    const size = bundle?.length ?? 0
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>${bundlePath}</d:href>
    <d:propstat>
      <d:prop>
        <d:getcontentlength>${size}</d:getcontentlength>
        <d:getlastmodified>${new Date(lastPublishedAt ?? Date.now()).toUTCString()}</d:getlastmodified>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`
    writeDavHeaders(res, { 'Content-Type': 'application/xml; charset=utf-8' })
    res.writeHead(207)
    res.end(xml)
    return
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    const bundle = readEncryptedBundleFromServer()
    if (!bundle) {
      res.writeHead(404)
      res.end('Bundle not found')
      return
    }
    writeDavHeaders(res, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(bundle.length),
      'Last-Modified': new Date(lastPublishedAt ?? Date.now()).toUTCString(),
    })
    res.writeHead(200)
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    res.end(bundle)
    return
  }

  if (req.method === 'PUT' && url.pathname === bundlePath) {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const payload = Buffer.concat(chunks)
      fs.mkdirSync(getSyncServerDir(), { recursive: true })
      fs.writeFileSync(getSyncBundlePath(), payload)
      lastPublishedAt = Date.now()
      res.writeHead(204)
      res.end()
    })
    return
  }

  res.writeHead(405)
  res.end('Method Not Allowed')
}

function schedulePublish(): void {
  if (publishTimer) clearTimeout(publishTimer)
  publishTimer = setTimeout(() => {
    publishTimer = null
    if (!isUnlocked() || !httpServer) return
    try {
      const result = publishEncryptedBundle()
      lastPublishedAt = Date.now()
      lastPublishedRevision = result.revision
    } catch {
      // ignore when locked
    }
  }, 3000)
}

export function notifyVaultChangedForSync(): void {
  const settings = readSettings()
  if (!settings.serverEnabled || !httpServer) return
  schedulePublish()
}

export function getWifiSyncServerStatus(): WifiSyncServerStatus {
  const settings = readSettings()
  const bundle = readEncryptedBundleFromServer()
  return {
    running: httpServer != null,
    port: httpServer ? settings.port : null,
    host: httpServer ? getLanHost() : null,
    accessPassword: settings.accessPassword,
    certificateFingerprint,
    verificationCode: getVerificationCode(),
    lastPublishedAt,
    lastPublishedRevision,
    bundleSizeBytes: bundle?.length ?? 0,
  }
}

export function getWifiSyncPairingInfo(): WifiSyncPairingInfo {
  const settings = readSettings()
  const host = getLanHost()
  const verificationCode = getVerificationCode()
  const qrPayload = JSON.stringify({
    host,
    port: settings.port,
    accessPassword: settings.accessPassword,
    fingerprint: certificateFingerprint,
    verificationCode,
    secure: true,
  })

  return {
    host,
    port: settings.port,
    accessPassword: settings.accessPassword,
    certificateFingerprint,
    verificationCode,
    qrPayload,
    secure: true,
  }
}

function publishBonjour(port: number): void {
  if (bonjour) {
    publishedService?.stop()
    bonjour.destroy()
  }
  bonjour = new Bonjour()
  publishedService = bonjour.publish({
    name: 'PwdBook Sync',
    type: SERVICE_TYPE,
    port,
    txt: {
      fingerprint: certificateFingerprint,
      path: SYNC_WEBDAV_PATH,
      file: SYNC_BUNDLE_FILENAME,
    },
  })
}

export async function startWifiSyncServer(): Promise<WifiSyncServerStatus> {
  const settings = readSettings()
  if (httpServer) {
    return getWifiSyncServerStatus()
  }

  ensureTlsMaterials()
  fs.mkdirSync(getSyncServerDir(), { recursive: true })

  const server = https.createServer(tlsOptions!, (req, res) => {
    handleDavRequest(req, res, settings.accessPassword)
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(settings.port, '0.0.0.0', () => resolve())
  })

  httpServer = server
  updateWifiSyncSettings({ serverEnabled: true })
  publishBonjour(settings.port)

  if (isUnlocked()) {
    const result = publishEncryptedBundle()
    lastPublishedAt = Date.now()
    lastPublishedRevision = result.revision
  }

  return getWifiSyncServerStatus()
}

export async function restoreWifiSyncServerIfNeeded(): Promise<void> {
  const settings = readSettings()
  if (!settings.serverEnabled || httpServer || !isUnlocked()) return
  await startWifiSyncServer()
}

export async function stopWifiSyncServer(): Promise<WifiSyncServerStatus> {
  if (publishTimer) {
    clearTimeout(publishTimer)
    publishTimer = null
  }

  if (publishedService) {
    publishedService.stop()
    publishedService = null
  }
  if (bonjour) {
    bonjour.destroy()
    bonjour = null
  }

  if (httpServer) {
    await new Promise<void>((resolve, reject) => {
      httpServer!.close((error) => (error ? reject(error) : resolve()))
    })
    httpServer = null
  }

  updateWifiSyncSettings({ serverEnabled: false })
  return getWifiSyncServerStatus()
}

export async function discoverWifiSyncServers(
  timeoutMs = 3000,
): Promise<WifiSyncDiscoveredServer[]> {
  const browser = new Bonjour()
  const found = new Map<string, WifiSyncDiscoveredServer>()

  return new Promise((resolve) => {
    const browserInstance = browser.find({ type: SERVICE_TYPE })

    browserInstance.on('up', (service) => {
      const host = service.addresses?.find((address) => address.includes('.')) ?? service.host
      const fingerprint = service.txt?.fingerprint ?? ''
      const key = `${host}:${service.port}`
      found.set(key, {
        name: service.name,
        host,
        port: service.port,
        fingerprint,
      })
    })

    setTimeout(() => {
      browserInstance.stop()
      browser.destroy()
      resolve(Array.from(found.values()))
    }, timeoutMs)
  })
}

export function verifyPairingFingerprint(expected: string, actual: string): boolean {
  return expected.trim().toUpperCase() === actual.trim().toUpperCase()
}

export function deriveTransportKeyFromPassword(masterPassword: string): Buffer {
  return deriveSyncTransportKey(masterPassword)
}
