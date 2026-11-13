import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { isValidSqliteHeader } from './accountPaths'
import { writeMachineDocument } from './machineStore'
import {
  DEFAULT_ACCOUNT_NAME,
  MACHINE_DB_KEYS,
  defaultMachineSettings,
  parseMachineDocument,
  type MachineDocument,
  type MachineSettings,
} from '../../shared/machineDocument'

export type BootResult =
  | { kind: 'ready'; document: MachineDocument; warning: 'delete-incomplete' | null }
  | { kind: 'fresh' }
  | { kind: 'blocked'; reason: 'registry-corrupt' | 'registry-inconsistent' | 'ambiguous-accounts' }

const DELETING_SUFFIX = '.deleting'
const MOVED_DIRECTORIES = ['attachments', 'sync-server', 'wifi-sync-certs'] as const

const BOOLEAN_SETTINGS = [
  ['launch_at_login_enabled', 'launchAtLoginEnabled'],
  ['quick_bar_enabled', 'quickBarEnabled'],
  ['main_window_shortcut_enabled', 'mainWindowShortcutEnabled'],
  ['notes_manager_shortcut_enabled', 'notesManagerShortcutEnabled'],
] as const satisfies ReadonlyArray<readonly [string, keyof MachineSettings]>

const TEXT_SETTINGS = [
  ['quick_bar_accelerator', 'quickBarAccelerator'],
  ['main_window_shortcut_accelerator', 'mainWindowShortcutAccelerator'],
  ['notes_manager_accelerator', 'notesManagerAccelerator'],
  ['clipboard_accelerator', 'clipboardAccelerator'],
  ['browser_extension_id', 'browserExtensionId'],
] as const satisfies ReadonlyArray<readonly [string, keyof MachineSettings]>

let sqlPromise: Promise<SqlJsStatic> | null = null

function getSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: () => path.join(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm'),
    })
  }
  return sqlPromise
}

type RegistryRead =
  | { status: 'absent' }
  | { status: 'valid'; document: MachineDocument }
  | { status: 'corrupt' }

function readRegistry(file: string): RegistryRead {
  if (!fs.existsSync(file)) return { status: 'absent' }
  try {
    const document = parseMachineDocument(JSON.parse(fs.readFileSync(file, 'utf8')))
    if (!document) return { status: 'corrupt' }
    return { status: 'valid', document }
  } catch {
    return { status: 'corrupt' }
  }
}

function quarantineFile(filePath: string, now: () => number): void {
  const timestamp = new Date(now()).toISOString().replace(/[:.]/g, '-')
  fs.renameSync(filePath, `${filePath}.corrupt-${timestamp}`)
}

function accountsDir(userData: string): string {
  return path.join(userData, 'accounts')
}

function listAccountEntries(userData: string): fs.Dirent[] {
  const dir = accountsDir(userData)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true })
}

function listDeletingIds(userData: string): string[] {
  return listAccountEntries(userData)
    .filter((entry) => entry.isDirectory() && entry.name.endsWith(DELETING_SUFFIX))
    .map((entry) => entry.name.slice(0, -DELETING_SUFFIX.length))
}

function listAccountDbIds(userData: string): string[] {
  const ids: string[] = []
  for (const entry of listAccountEntries(userData)) {
    if (!entry.isDirectory() || entry.name.endsWith(DELETING_SUFFIX)) continue
    if (fs.existsSync(path.join(accountsDir(userData), entry.name, 'pwdbook.db'))) ids.push(entry.name)
  }
  return ids
}

function hasAccountResidue(userData: string): boolean {
  for (const entry of listAccountEntries(userData)) {
    if (!entry.isDirectory()) continue
    if (entry.name.endsWith(DELETING_SUFFIX)) return true
    const dir = path.join(accountsDir(userData), entry.name)
    if (fs.existsSync(path.join(dir, 'pwdbook.db'))) return true
    if (fs.readdirSync(dir).some((name) => name.endsWith(DELETING_SUFFIX))) return true
  }
  return false
}

function reconcileDeleting(userData: string, listedIds: ReadonlySet<string>): 'delete-incomplete' | null {
  let warning: 'delete-incomplete' | null = null
  for (const id of listDeletingIds(userData)) {
    const source = path.join(accountsDir(userData), `${id}${DELETING_SUFFIX}`)
    if (listedIds.has(id)) {
      fs.renameSync(source, path.join(accountsDir(userData), id))
      warning = 'delete-incomplete'
    } else {
      fs.rmSync(source, { recursive: true, force: true })
    }
  }
  return warning
}

function hasSqliteHeader(file: string): boolean {
  const fd = fs.openSync(file, 'r')
  try {
    const buffer = Buffer.alloc(16)
    fs.readSync(fd, buffer, 0, 16, 0)
    return isValidSqliteHeader(buffer)
  } finally {
    fs.closeSync(fd)
  }
}

function readStoredBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

function readAppSettings(db: Database): Map<string, string> | null {
  const table = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_settings'")
  if (table.length === 0 || table[0].values.length === 0) return null
  const rows = new Map<string, string>()
  const stmt = db.prepare('SELECT key, value FROM app_settings')
  while (stmt.step()) {
    const [key, value] = stmt.get()
    rows.set(String(key), value == null ? '' : String(value))
  }
  stmt.free()
  return rows
}

function settingsFromRows(rows: Map<string, string> | null): MachineSettings {
  const settings = defaultMachineSettings()
  if (!rows) return settings
  if (rows.get('ui_locale') === 'en') settings.uiLocale = 'en'
  for (const [key, field] of BOOLEAN_SETTINGS) {
    settings[field] = readStoredBoolean(rows.get(key), settings[field])
  }
  const closeWindowAction = rows.get('close_window_action')
  if (closeWindowAction === 'tray' || closeWindowAction === 'quit') {
    settings.closeWindowAction = closeWindowAction
  } else if (closeWindowAction !== undefined) {
    settings.closeWindowAction = 'ask'
  }
  for (const [key, field] of TEXT_SETTINGS) {
    const value = rows.get(key)
    if (value !== undefined) settings[field] = value
  }
  const autoUpdate = rows.get('auto_update_enabled')
  if (autoUpdate === 'true' || autoUpdate === 'false') {
    settings.autoUpdateEnabled = autoUpdate === 'true'
  }
  return settings
}

async function extractMachineSettings(dbFile: string): Promise<MachineSettings> {
  const SQL = await getSql()
  const db = new SQL.Database(fs.readFileSync(dbFile))
  try {
    const rows = readAppSettings(db)
    const settings = settingsFromRows(rows)
    if (rows) {
      for (const key of MACHINE_DB_KEYS) {
        db.run('DELETE FROM app_settings WHERE key = ?', [key])
      }
      fs.writeFileSync(dbFile, Buffer.from(db.export()))
    }
    return settings
  } finally {
    db.close()
  }
}

function accountDocument(id: string, createdAt: number, settings: MachineSettings): MachineDocument {
  return {
    version: 1,
    activeAccountId: id,
    accounts: [{ id, name: DEFAULT_ACCOUNT_NAME, createdAt }],
    settings,
  }
}

async function migrateLegacy(
  userData: string,
  now: () => number,
  createId: () => string,
): Promise<BootResult> {
  const id = createId()
  const dir = path.join(accountsDir(userData), id)
  fs.mkdirSync(dir, { recursive: true })
  fs.renameSync(path.join(userData, 'pwdbook.db'), path.join(dir, 'pwdbook.db'))
  for (const name of MOVED_DIRECTORIES) {
    const source = path.join(userData, name)
    if (!fs.existsSync(source)) continue
    fs.renameSync(source, path.join(dir, name))
  }
  const settings = await extractMachineSettings(path.join(dir, 'pwdbook.db'))
  const document = accountDocument(id, now(), settings)
  writeMachineDocument(userData, document)
  return { kind: 'ready', document, warning: null }
}

async function adoptOrphan(userData: string, id: string, now: () => number): Promise<BootResult> {
  const settings = await extractMachineSettings(path.join(accountsDir(userData), id, 'pwdbook.db'))
  const document = accountDocument(id, now(), settings)
  writeMachineDocument(userData, document)
  return { kind: 'ready', document, warning: null }
}

export async function bootAccounts(
  userData: string,
  now: () => number = Date.now,
  createId: () => string = randomUUID,
): Promise<BootResult> {
  const registryPath = path.join(userData, 'machine.json')
  const registry = readRegistry(registryPath)

  if (registry.status === 'valid') {
    if (!registry.document.accounts.some((account) => account.id === registry.document.activeAccountId)) {
      return { kind: 'blocked', reason: 'registry-inconsistent' }
    }
    const warning = reconcileDeleting(
      userData,
      new Set(registry.document.accounts.map((account) => account.id)),
    )
    return { kind: 'ready', document: registry.document, warning }
  }

  if (registry.status === 'corrupt') {
    quarantineFile(registryPath, now)
    if (hasAccountResidue(userData)) {
      return { kind: 'blocked', reason: 'registry-corrupt' }
    }
  }

  reconcileDeleting(userData, new Set())

  const legacyDb = path.join(userData, 'pwdbook.db')
  if (fs.existsSync(legacyDb)) {
    if (!hasSqliteHeader(legacyDb)) {
      quarantineFile(legacyDb, now)
      return { kind: 'fresh' }
    }
    return migrateLegacy(userData, now, createId)
  }

  const ids = listAccountDbIds(userData)
  if (ids.length > 1) return { kind: 'blocked', reason: 'ambiguous-accounts' }
  if (ids.length === 1) return adoptOrphan(userData, ids[0], now)
  return { kind: 'fresh' }
}
