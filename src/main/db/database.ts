import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { seedAndMigrateCategories } from './categories'
import { appError, ErrorCode } from '../../shared/errors'

let sqlPromise: Promise<SqlJsStatic> | null = null
let db: Database | null = null
let dbPath = ''

function getWasmDirectory(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist')
  }
  return path.join(app.getAppPath(), 'node_modules', 'sql.js', 'dist')
}

async function getSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) => path.join(getWasmDirectory(), file),
    })
  }
  return sqlPromise
}

export function persistDatabase(): void {
  if (!db) return
  const data = db.export()
  fs.writeFileSync(dbPath, Buffer.from(data))
  void import('../services/wifiSyncService')
    .then((module) => module.notifyVaultChangedForSync())
    .catch(() => {})
  void import('../services/folderSyncService')
    .then((module) => module.notifyVaultChangedForFolderSync())
    .catch(() => {})
}

export async function initDatabase(): Promise<Database> {
  if (db) return db

  const SQL = await getSql()
  dbPath = path.join(app.getPath('userData'), 'pwdbook.db')

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS password_entries (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL DEFAULT '',
      username TEXT NOT NULL DEFAULT '',
      password_encrypted TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'cat-work',
      tags TEXT NOT NULL DEFAULT '[]',
      is_favorite INTEGER NOT NULL DEFAULT 0,
      last_used_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    )
  `)

  seedAndMigrateCategories(db)

  migrateEntryDisplayIcon(db)
  migrateEntryLocalProgramPath(db)
  migrateEntryDeletedAt(db)
  migrateEntryTotpSecret(db)

  db.run(`
    CREATE TABLE IF NOT EXISTS entry_attachments (
      id TEXT PRIMARY KEY NOT NULL,
      entry_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      size_bytes INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_attachments_entry_id ON entry_attachments(entry_id)
  `)

  persistDatabase()
  return db
}

export function getDatabase(): Database {
  if (!db) {
    throw appError(ErrorCode.DATABASE_NOT_INITIALIZED)
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    persistDatabase()
    db.close()
    db = null
  }
}

export function resetDatabaseFile(): void {
  closeDatabase()
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath)
  }
  const attachmentsDir = path.join(path.dirname(dbPath), 'attachments')
  if (fs.existsSync(attachmentsDir)) {
    fs.rmSync(attachmentsDir, { recursive: true, force: true })
  }
}

function readEntryTableColumns(db: Database): string[] {
  const info = db.exec('PRAGMA table_info(password_entries)')
  return info.length > 0 ? info[0].values.map((value) => String(value[1])) : []
}

function migrateEntryDisplayIcon(db: Database): void {
  const columns = readEntryTableColumns(db)
  if (!columns.includes('display_icon')) {
    db.run(`ALTER TABLE password_entries ADD COLUMN display_icon TEXT NOT NULL DEFAULT ''`)
  }
}

function migrateEntryLocalProgramPath(db: Database): void {
  const columns = readEntryTableColumns(db)
  if (!columns.includes('local_program_path')) {
    db.run(`ALTER TABLE password_entries ADD COLUMN local_program_path TEXT NOT NULL DEFAULT ''`)
  }
}

function migrateEntryDeletedAt(db: Database): void {
  const columns = readEntryTableColumns(db)
  if (!columns.includes('deleted_at')) {
    db.run(`ALTER TABLE password_entries ADD COLUMN deleted_at INTEGER`)
  }
}

function migrateEntryTotpSecret(db: Database): void {
  const columns = readEntryTableColumns(db)
  if (!columns.includes('totp_secret_encrypted')) {
    db.run(`ALTER TABLE password_entries ADD COLUMN totp_secret_encrypted TEXT NOT NULL DEFAULT ''`)
  }
}
