import { app } from 'electron'
import path from 'path'
import { verifyMasterPassword } from '../crypto/vaultCrypto'
import {
  VaultFileDamagedError,
  closeDatabase,
  createEmptyDatabase,
  initDatabase,
  resetDatabaseFile,
  setDatabaseFile,
} from '../db/database'
import { getSetting } from '../db/helpers'
import { isUnlocked, lockSession } from '../services/sessionService'
import { setupVault } from '../services/vaultService'
import type { AccountDeps } from './accountService'

export function liveAccountDeps(): AccountDeps {
  return {
    get userData(): string {
      return app.getPath('userData')
    },
    isUnlocked: () => isUnlocked(),
    lockSession: () => lockSession(),
    verifyPassword(password: string): boolean {
      const salt = getSetting('master_salt')
      const hash = getSetting('master_hash')
      if (!salt || !hash) return false
      try {
        return verifyMasterPassword(password, salt, hash)
      } catch {
        return false
      }
    },
    async openDatabase(file: string): Promise<'ready' | 'missing'> {
      setDatabaseFile(file)
      try {
        await initDatabase()
        return 'ready'
      } catch (error) {
        if (error instanceof VaultFileDamagedError) return 'missing'
        throw error
      }
    },
    async createEmpty(file: string): Promise<void> {
      setDatabaseFile(file)
      await createEmptyDatabase()
    },
    async setup(masterPassword: string, confirmPassword: string): Promise<void> {
      setupVault(masterPassword, confirmPassword)
    },
    closeDatabase(): void {
      closeDatabase()
    },
    resetAccountFiles(accountDir: string): void {
      setDatabaseFile(path.join(accountDir, 'pwdbook.db'))
      resetDatabaseFile()
    },
  }
}
