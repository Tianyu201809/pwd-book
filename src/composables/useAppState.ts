import { ref, computed } from 'vue'
import { vaultApi } from '@/services/vaultApi'
import {
  formatEntryForClipboard,
  formatRelativeTime,
  generatePassword,
  getAvatarMeta,
} from '@/shared/utils'
import type {
  AppScreen,
  CategoryInput,
  FilterCategory,
  ListSortOrder,
  PasswordEntry,
  PasswordEntryInput,
  SecuritySettings,
  SettingsTab,
  VaultCategory,
  VaultStatus,
} from '@/types'

const LEGACY_CATEGORY_MAP: Record<string, string> = {
  work: 'cat-work',
  social: 'cat-social',
  finance: 'cat-finance',
  other: 'cat-other',
}

const screen = ref<AppScreen>('lock')
const settingsTab = ref<SettingsTab>('security')
const vaultStatus = ref<VaultStatus>({ initialized: false, unlocked: false })
const securitySettings = ref<SecuritySettings>({
  autoLockMinutes: 15,
  clipboardClearEnabled: true,
  clipboardClearSeconds: 30,
})

const selectedCategory = ref<FilterCategory>('all')
const selectedEntryId = ref<string | null>(null)
const searchQuery = ref('')
const listSortOrder = ref<ListSortOrder>('recent')
const entries = ref<PasswordEntry[]>([])
const vaultCategories = ref<VaultCategory[]>([])
const isCreating = ref(false)
const loading = ref(false)
const errorMessage = ref('')
const lastActivityAt = ref(Date.now())

const systemCategories = computed(() => [
  { id: 'all' as const, label: '全部', icon: 'LayoutGrid', count: entries.value.length },
  {
    id: 'favorite' as const,
    label: '收藏',
    icon: 'Star',
    count: entries.value.filter((entry) => entry.isFavorite).length,
  },
])

const customCategories = computed(() =>
  vaultCategories.value.map((category) => ({
    id: category.id,
    label: category.name,
    icon: category.icon,
    count: entries.value.filter((entry) => entry.categoryId === category.id).length,
  })),
)

const categories = computed(() => [...systemCategories.value, ...customCategories.value])

const filteredEntries = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return entries.value.filter((entry) => {
    const matchCategory =
      selectedCategory.value === 'all' ||
      (selectedCategory.value === 'favorite'
        ? entry.isFavorite
        : entry.categoryId === selectedCategory.value)
    const matchSearch =
      !q ||
      entry.title.toLowerCase().includes(q) ||
      entry.username.toLowerCase().includes(q) ||
      entry.url.toLowerCase().includes(q) ||
      entry.categoryName.toLowerCase().includes(q) ||
      entry.tags.some((tag) => tag.toLowerCase().includes(q))
    return matchCategory && matchSearch
  })
})

const selectedEntry = computed(() => {
  if (isCreating.value) return null
  return (
    entries.value.find((entry) => entry.id === selectedEntryId.value) ??
    filteredEntries.value[0] ??
    null
  )
})

function sortEntries(list: PasswordEntry[]): PasswordEntry[] {
  const sorted = [...list]
  if (listSortOrder.value === 'title') {
    return sorted.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'))
  }
  if (listSortOrder.value === 'created') {
    return sorted.sort((a, b) => b.createdAt - a.createdAt)
  }
  return sorted.sort((a, b) => {
    const aTime = a.lastUsedAt ?? 0
    const bTime = b.lastUsedAt ?? 0
    if (aTime !== bTime) return bTime - aTime
    return b.updatedAt - a.updatedAt
  })
}

const displayEntries = computed(() =>
  sortEntries(filteredEntries.value).map((entry) => ({
    ...entry,
    lastUsedLabel: formatRelativeTime(entry.lastUsedAt),
    avatar: getAvatarMeta(entry.title),
  })),
)

const defaultCategoryId = computed(
  () => vaultCategories.value.find((item) => item.id === 'cat-other')?.id ?? vaultCategories.value[0]?.id ?? '',
)

function touchActivity(): void {
  lastActivityAt.value = Date.now()
}

function setError(error: unknown): void {
  errorMessage.value = error instanceof Error ? error.message : '操作失败'
}

function clearError(): void {
  errorMessage.value = ''
}

function normalizeImportEntry(raw: Record<string, unknown>): PasswordEntryInput {
  const categoryId =
    (raw.categoryId as string | undefined) ??
    LEGACY_CATEGORY_MAP[String(raw.category ?? '')] ??
    defaultCategoryId.value

  return {
    title: String(raw.title ?? ''),
    url: String(raw.url ?? ''),
    username: String(raw.username ?? ''),
    password: String(raw.password ?? ''),
    note: String(raw.note ?? ''),
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    categoryId,
    isFavorite: Boolean(raw.isFavorite),
  }
}

async function refreshCategories(): Promise<void> {
  vaultCategories.value = await vaultApi.listCategories()
}

async function refreshEntries(): Promise<void> {
  entries.value = await vaultApi.listEntries()
  if (!isCreating.value) {
    const exists = entries.value.some((entry) => entry.id === selectedEntryId.value)
    if (!exists) {
      selectedEntryId.value = filteredEntries.value[0]?.id ?? null
    }
  }
}

async function refreshVaultData(): Promise<void> {
  await Promise.all([refreshCategories(), refreshEntries()])
}

async function bootstrap(): Promise<void> {
  loading.value = true
  try {
    vaultStatus.value = await vaultApi.getVaultStatus()
    securitySettings.value = await vaultApi.getSettings()
    if (vaultStatus.value.unlocked) {
      await refreshVaultData()
      screen.value = 'vault'
    } else {
      screen.value = 'lock'
    }
  } catch (error) {
    setError(error)
  } finally {
    loading.value = false
  }
}

async function setupVault(masterPassword: string, confirmPassword: string): Promise<boolean> {
  loading.value = true
  clearError()
  try {
    vaultStatus.value = await vaultApi.setupVault({ masterPassword, confirmPassword })
    await refreshVaultData()
    screen.value = 'vault'
    touchActivity()
    return true
  } catch (error) {
    setError(error)
    return false
  } finally {
    loading.value = false
  }
}

async function unlock(masterPassword: string): Promise<boolean> {
  loading.value = true
  clearError()
  try {
    vaultStatus.value = await vaultApi.unlockVault({ masterPassword })
    await refreshVaultData()
    screen.value = 'vault'
    touchActivity()
    return true
  } catch (error) {
    setError(error)
    return false
  } finally {
    loading.value = false
  }
}

async function lock(): Promise<void> {
  vaultStatus.value = await vaultApi.lockVault()
  entries.value = []
  vaultCategories.value = []
  selectedEntryId.value = null
  isCreating.value = false
  screen.value = 'lock'
}

function navigateTo(next: AppScreen, tab: SettingsTab = 'security'): void {
  screen.value = next
  if (next === 'settings') settingsTab.value = tab
  touchActivity()
}

function selectCategory(id: FilterCategory): void {
  selectedCategory.value = id
  isCreating.value = false
  selectedEntryId.value = filteredEntries.value[0]?.id ?? null
  touchActivity()
}

function selectEntry(id: string): void {
  isCreating.value = false
  selectedEntryId.value = id
  touchActivity()
}

function startCreateEntry(): void {
  isCreating.value = true
  selectedEntryId.value = null
  touchActivity()
}

function cancelCreateEntry(): void {
  isCreating.value = false
  selectedEntryId.value = filteredEntries.value[0]?.id ?? null
}

function getCreateDefaultCategoryId(): string {
  if (selectedCategory.value !== 'all' && selectedCategory.value !== 'favorite') {
    return selectedCategory.value
  }
  return defaultCategoryId.value
}

async function saveEntry(id: string | null, input: PasswordEntryInput): Promise<boolean> {
  loading.value = true
  clearError()
  try {
    const saved = id
      ? await vaultApi.updateEntry(id, input)
      : await vaultApi.createEntry(input)
    isCreating.value = false
    selectedEntryId.value = saved.id
    await refreshVaultData()
    touchActivity()
    return true
  } catch (error) {
    setError(error)
    return false
  } finally {
    loading.value = false
  }
}

async function removeEntry(id: string): Promise<boolean> {
  loading.value = true
  clearError()
  try {
    await vaultApi.deleteEntry(id)
    if (selectedEntryId.value === id) {
      selectedEntryId.value = null
    }
    await refreshVaultData()
    touchActivity()
    return true
  } catch (error) {
    setError(error)
    return false
  } finally {
    loading.value = false
  }
}

async function toggleFavorite(id: string): Promise<void> {
  clearError()
  try {
    await vaultApi.toggleFavorite(id)
    await refreshVaultData()
    touchActivity()
  } catch (error) {
    setError(error)
  }
}

async function createCategory(input: CategoryInput): Promise<boolean> {
  loading.value = true
  clearError()
  try {
    const created = await vaultApi.createCategory(input)
    await refreshVaultData()
    selectedCategory.value = created.id
    touchActivity()
    return true
  } catch (error) {
    setError(error)
    return false
  } finally {
    loading.value = false
  }
}

async function deleteCategory(id: string): Promise<boolean> {
  loading.value = true
  clearError()
  try {
    await vaultApi.deleteCategory(id)
    if (selectedCategory.value === id) {
      selectedCategory.value = 'all'
    }
    await refreshVaultData()
    touchActivity()
    return true
  } catch (error) {
    setError(error)
    return false
  } finally {
    loading.value = false
  }
}

async function copyUsername(text: string): Promise<void> {
  await vaultApi.copySecret(text, 0)
  touchActivity()
}

async function copyEntryData(entry: PasswordEntry): Promise<void> {
  await vaultApi.copySecret(formatEntryForClipboard(entry), 0)
  touchActivity()
}

async function copyPassword(id: string, text: string): Promise<void> {
  await vaultApi.copySecret(text)
  await vaultApi.touchEntry(id)
  await refreshEntries()
  touchActivity()
}

function createGeneratedPassword(length = 16): string {
  return generatePassword(length)
}

async function updateSecuritySettings(partial: Partial<SecuritySettings>): Promise<void> {
  securitySettings.value = await vaultApi.updateSettings(partial)
  touchActivity()
}

async function exportData(): Promise<string> {
  const payload = await vaultApi.exportData()
  touchActivity()
  return JSON.stringify(payload, null, 2)
}

async function importDataFromJson(raw: string): Promise<number> {
  const parsed = JSON.parse(raw) as { entries?: Record<string, unknown>[] }
  const entriesToImport = (parsed.entries ?? []).map(normalizeImportEntry)
  const count = await vaultApi.importData(entriesToImport)
  await refreshVaultData()
  touchActivity()
  return count
}

async function resetAllData(): Promise<void> {
  await vaultApi.resetVault()
  vaultStatus.value = { initialized: false, unlocked: false }
  entries.value = []
  vaultCategories.value = []
  selectedEntryId.value = null
  isCreating.value = false
  screen.value = 'lock'
}

function switchSettingsTab(tab: SettingsTab): void {
  settingsTab.value = tab
  touchActivity()
}

function setListSortOrder(order: ListSortOrder): void {
  listSortOrder.value = order
  touchActivity()
}

export function useAppState() {
  return {
    screen,
    settingsTab,
    vaultStatus,
    securitySettings,
    selectedCategory,
    selectedEntryId,
    searchQuery,
    listSortOrder,
    entries,
    vaultCategories,
    isCreating,
    loading,
    errorMessage,
    lastActivityAt,
    categories,
    customCategories,
    filteredEntries,
    displayEntries,
    selectedEntry,
    defaultCategoryId,
    bootstrap,
    setupVault,
    unlock,
    lock,
    navigateTo,
    selectCategory,
    selectEntry,
    startCreateEntry,
    cancelCreateEntry,
    getCreateDefaultCategoryId,
    saveEntry,
    removeEntry,
    toggleFavorite,
    createCategory,
    deleteCategory,
    copyUsername,
    copyPassword,
    copyEntryData,
    createGeneratedPassword,
    updateSecuritySettings,
    exportData,
    importDataFromJson,
    resetAllData,
    switchSettingsTab,
    setListSortOrder,
    touchActivity,
    clearError,
  }
}
