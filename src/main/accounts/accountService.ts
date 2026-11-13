import { randomUUID } from 'crypto'
import fs from 'fs'
import { createRequire } from 'module'
import path from 'path'
import { normalizeAccountName, validateAccountName } from '../../shared/accountName'
import { ErrorCode } from '../../shared/errors'
import {
  defaultMachineSettings,
  type AccountRecord,
  type MachineDocument,
} from '../../shared/machineDocument'
import { setActiveAccountId } from './activeAccount'
import { accountDataPaths } from './accountPaths'
import { readMachineDocument, writeMachineDocument } from './machineStore'

const require = createRequire(import.meta.url)

export interface AccountDeps {
  userData: string
  isUnlocked(): boolean
  lockSession(): void
  verifyPassword(password: string): boolean
  openDatabase(file: string): Promise<'ready' | 'missing'>
  createEmpty(file: string): Promise<void>
  setup(masterPassword: string, confirmPassword: string): Promise<void>
  closeDatabase(): void
  resetAccountFiles(accountDir: string): void
}

interface ElectronModule {
  app: { getPath(name: 'userData'): string }
}

interface SessionModule {
  isUnlocked(): boolean
  lockSession(): void
}

interface SettingsModule {
  getSetting(key: string): string | null
}

interface VaultCryptoModule {
  verifyMasterPassword(password: string, saltHex: string, hashHex: string): boolean
}

interface DatabaseModule {
  setDatabaseFile(filePath: string): void
  initDatabase(): Promise<unknown>
  createEmptyDatabase(): Promise<unknown>
  closeDatabase(): void
  resetDatabaseFile(): void
  VaultFileDamagedError: new (quarantinedPath: string | null) => Error
}

interface VaultModule {
  setupVault(masterPassword: string, confirmPassword: string): void
}

function defaultAccountDeps(): AccountDeps {
  const electron = require('electron') as ElectronModule
  const session = require('../services/sessionService') as SessionModule
  const settings = require('../db/helpers') as SettingsModule
  const vaultCrypto = require('../crypto/vaultCrypto') as VaultCryptoModule
  const database = require('../db/database') as DatabaseModule
  const vault = require('../services/vaultService') as VaultModule

  return {
    get userData(): string {
      return electron.app.getPath('userData')
    },
    isUnlocked: () => session.isUnlocked(),
    lockSession: () => session.lockSession(),
    verifyPassword(password: string): boolean {
      const salt = settings.getSetting('master_salt')
      const hash = settings.getSetting('master_hash')
      if (!salt || !hash) return false
      try {
        return vaultCrypto.verifyMasterPassword(password, salt, hash)
      } catch {
        return false
      }
    },
    async openDatabase(file: string): Promise<'ready' | 'missing'> {
      database.setDatabaseFile(file)
      await database.initDatabase()
      return 'ready'
    },
    async createEmpty(file: string): Promise<void> {
      database.setDatabaseFile(file)
      await database.createEmptyDatabase()
    },
    async setup(masterPassword: string, confirmPassword: string): Promise<void> {
      await vault.setupVault(masterPassword, confirmPassword)
    },
    closeDatabase(): void {
      database.closeDatabase()
    },
    resetAccountFiles(accountDir: string): void {
      database.setDatabaseFile(path.join(accountDir, 'pwdbook.db'))
      database.resetDatabaseFile()
    },
  }
}

function useDeps(deps?: AccountDeps): AccountDeps {
  return deps ?? defaultAccountDeps()
}

function validatedName(name: string, existingNames: readonly string[]): string {
  const problem = validateAccountName(name, existingNames)
  if (problem === 'empty') throw new Error(ErrorCode.ACCOUNT_NAME_EMPTY)
  if (problem === 'too-long') throw new Error(ErrorCode.ACCOUNT_NAME_TOO_LONG)
  if (problem === 'duplicate') throw new Error(ErrorCode.ACCOUNT_NAME_EXISTS)
  return normalizeAccountName(name)
}

function requireActiveAccount(userData: string): { document: MachineDocument; account: AccountRecord } {
  const document = readMachineDocument(userData)
  const account = document?.accounts.find((item) => item.id === document.activeAccountId)
  if (!document || !account) throw new Error(ErrorCode.ACCOUNT_NOT_FOUND)
  return { document, account }
}

async function restorePreviousAccount(deps: AccountDeps, previousId: string): Promise<void> {
  if (!previousId) return
  setActiveAccountId(previousId)
  await deps.openDatabase(accountDataPaths(deps.userData, previousId).database)
}

export async function createAccount(
  input: { name: string; masterPassword: string; confirmPassword: string },
  deps?: AccountDeps,
): Promise<MachineDocument> {
  const resolved = useDeps(deps)
  const document = readMachineDocument(resolved.userData)
  const normalized = validatedName(input.name, document?.accounts.map((account) => account.name) ?? [])
  const previousId = document?.activeAccountId ?? ''
  const id = randomUUID()
  const created = accountDataPaths(resolved.userData, id)
  let wroteRegistry = false
  try {
    fs.mkdirSync(created.dir, { recursive: true })
    await resolved.createEmpty(created.database)
    setActiveAccountId(id)
    await resolved.setup(input.masterPassword, input.confirmPassword)
    const next: MachineDocument = {
      version: 1,
      activeAccountId: id,
      accounts: [
        ...(document?.accounts ?? []),
        { id, name: normalized, createdAt: Date.now() },
      ],
      settings: document?.settings ?? defaultMachineSettings(),
    }
    writeMachineDocument(resolved.userData, next)
    wroteRegistry = true
    return next
  } catch (error) {
    fs.rmSync(created.dir, { recursive: true, force: true })
    if (wroteRegistry) {
      if (document) writeMachineDocument(resolved.userData, document)
      else fs.rmSync(path.join(resolved.userData, 'machine.json'), { force: true })
    }
    await restorePreviousAccount(resolved, previousId)
    throw error
  }
}

export async function selectAccount(accountId: string, deps?: AccountDeps): Promise<void> {
  const resolved = useDeps(deps)
  const document = readMachineDocument(resolved.userData)
  if (!document || !document.accounts.some((account) => account.id === accountId)) {
    throw new Error(ErrorCode.ACCOUNT_NOT_FOUND)
  }
  if (resolved.isUnlocked()) throw new Error(ErrorCode.VAULT_UNLOCK_REQUIRED)
  writeMachineDocument(resolved.userData, { ...document, activeAccountId: accountId })
  resolved.closeDatabase()
  setActiveAccountId(accountId)
  const status = await resolved.openDatabase(accountDataPaths(resolved.userData, accountId).database)
  if (status === 'missing') throw new Error(ErrorCode.VAULT_FILE_DAMAGED)
}

export async function renameAccount(name: string, deps?: AccountDeps): Promise<AccountRecord> {
  const resolved = useDeps(deps)
  const { document, account } = requireActiveAccount(resolved.userData)
  const others = document.accounts
    .filter((item) => item.id !== account.id)
    .map((item) => item.name)
  const updated: AccountRecord = { ...account, name: validatedName(name, others) }
  writeMachineDocument(resolved.userData, {
    ...document,
    accounts: document.accounts.map((item) => (item.id === account.id ? updated : item)),
  })
  return updated
}

export async function deleteAccount(masterPassword: string, deps?: AccountDeps): Promise<MachineDocument> {
  const resolved = useDeps(deps)
  const document = readMachineDocument(resolved.userData)
  if (!document || document.accounts.length < 2) throw new Error(ErrorCode.ACCOUNT_DELETE_LAST)
  const current = document.accounts.find((account) => account.id === document.activeAccountId)
  if (!current) throw new Error(ErrorCode.ACCOUNT_NOT_FOUND)
  if (!resolved.verifyPassword(masterPassword)) throw new Error(ErrorCode.WRONG_MASTER_PASSWORD)
  resolved.lockSession()
  resolved.closeDatabase()
  const currentPaths = accountDataPaths(resolved.userData, current.id)
  const deleting = `${currentPaths.dir}.deleting`
  fs.renameSync(currentPaths.dir, deleting)
  const accounts = document.accounts.filter((account) => account.id !== current.id)
  const nextAccount = accounts[0]
  if (!nextAccount) throw new Error(ErrorCode.ACCOUNT_DELETE_LAST)
  const next: MachineDocument = {
    ...document,
    activeAccountId: nextAccount.id,
    accounts,
  }
  writeMachineDocument(resolved.userData, next)
  fs.rmSync(deleting, { recursive: true, force: true })
  setActiveAccountId(next.activeAccountId)
  await resolved.openDatabase(accountDataPaths(resolved.userData, next.activeAccountId).database)
  return next
}

export async function rebuildEmptyVault(deps?: AccountDeps): Promise<void> {
  const resolved = useDeps(deps)
  if (resolved.isUnlocked()) throw new Error(ErrorCode.VAULT_UNLOCK_REQUIRED)
  const { account } = requireActiveAccount(resolved.userData)
  const paths = accountDataPaths(resolved.userData, account.id)
  resolved.resetAccountFiles(paths.dir)
  await resolved.createEmpty(paths.database)
}
