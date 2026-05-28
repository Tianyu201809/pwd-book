import type { ThemeNativeMode } from '@/services/vaultApi'
import type {
  CategoryInput,
  ExportPayload,
  PasswordEntry,
  PasswordEntryInput,
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
      setNativeTheme: (mode: ThemeNativeMode) => void
      getVaultStatus: () => Promise<VaultStatus>
      setupVault: (payload: VaultSetupPayload) => Promise<VaultStatus>
      unlockVault: (payload: VaultUnlockPayload) => Promise<VaultStatus>
      lockVault: () => Promise<VaultStatus>
      resetVault: () => Promise<VaultStatus>
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
      getSettings: () => Promise<SecuritySettings>
      updateSettings: (partial: Partial<SecuritySettings>) => Promise<SecuritySettings>
      copySecret: (text: string, clearAfterMs?: number) => Promise<void>
      exportData: () => Promise<ExportPayload>
      importData: (entries: PasswordEntryInput[]) => Promise<number>
    }
  }
}

export {}
