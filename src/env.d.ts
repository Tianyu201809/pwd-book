import type { ThemeNativeMode } from '@/services/vaultApi'
import type {
  CategoryInput,
  ExportPayload,
  PasswordEntry,
  PasswordEntryInput,
  RecoveryResetPayload,
  RecoveryVerifyResult,
  SecuritySettings,
  VaultCategory,
  VaultSetupPayload,
  VaultStatus,
  VaultUnlockPayload,
} from '@/shared/types'

declare global {
  interface Window {
    electronAPI?: {
      minimize: () => void
      maximize: () => void
      close: () => void
      onClosePrompt: (handler: () => void) => () => void
      onAlreadyRunning: (handler: () => void) => () => void
      setNativeTheme: (mode: ThemeNativeMode) => void
      getVaultStatus: () => Promise<VaultStatus>
      setupVault: (payload: VaultSetupPayload) => Promise<VaultStatus>
      unlockVault: (payload: VaultUnlockPayload) => Promise<VaultStatus>
      lockVault: () => Promise<VaultStatus>
      resetVault: () => Promise<VaultStatus>
      verifyRecoveryKey: (recoveryKey: string) => Promise<RecoveryVerifyResult>
      createRecoveryKey: () => Promise<{ recoveryKey: string }>
      resetMasterPasswordWithRecovery: (payload: RecoveryResetPayload) => Promise<VaultStatus>
      clearRecoveryKey: () => Promise<VaultStatus>
      regenerateRecoveryKey: (masterPassword: string) => Promise<{ recoveryKey: string }>
      listEntries: () => Promise<PasswordEntry[]>
      createEntry: (input: PasswordEntryInput) => Promise<PasswordEntry>
      updateEntry: (id: string, input: PasswordEntryInput) => Promise<PasswordEntry>
      deleteEntry: (id: string) => Promise<void>
      toggleFavorite: (id: string) => Promise<PasswordEntry>
      touchEntry: (id: string) => Promise<void>
      listCategories: () => Promise<VaultCategory[]>
      createCategory: (input: CategoryInput) => Promise<VaultCategory>
      updateCategory: (id: string, input: CategoryInput) => Promise<VaultCategory>
      deleteCategory: (id: string) => Promise<void>
      reorderCategories: (categoryIds: string[]) => Promise<VaultCategory[]>
      getSidebarCategoryOrder: () => Promise<string[]>
      reorderSidebarCategories: (order: string[]) => Promise<VaultCategory[]>
      getSettings: () => Promise<SecuritySettings>
      updateSettings: (partial: Partial<SecuritySettings>) => Promise<SecuritySettings>
      copySecret: (text: string, clearAfterMs?: number) => Promise<void>
      openExternal: (url: string) => Promise<void>
      exportData: () => Promise<ExportPayload>
      importData: (entries: PasswordEntryInput[]) => Promise<number>
    }
  }
}

export {}
