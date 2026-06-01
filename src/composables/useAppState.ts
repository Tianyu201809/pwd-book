import { ref, computed } from 'vue'
import { i18n } from '@/i18n'
import { vaultApi } from '@/services/vaultApi'
import {
  buildUrlWithCredentialParams,
  cloneForIpc,
  formatEntryForClipboard,
  formatRelativeTime,
  getAvatarMeta,
  parseErrorMessage,
} from '@/shared/utils'
import {
  DEFAULT_PASSWORD_GEN_OPTIONS,
  generatePasswordWithOptions,
} from '@/shared/passwordGenerator'
import { showToast } from '@/composables/useToast'
import type {
  AppScreen,
  CategoryInput,
  EmailBackupSettings,
  EmailBackupSettingsUpdate,
  FilterCategory,
  ListSortOrder,
  PasswordEntry,
  PasswordEntryInput,
  PasswordGenOptions,
  SecuritySettings,
  SettingsTab,
  VaultCategory,
  VaultTag,
  TagInput,
  VaultStatus,
} from '@/types'

const screen = ref<AppScreen>('lock')
const settingsTab = ref<SettingsTab>('security')
const vaultStatus = ref<VaultStatus>({
  initialized: false,
  unlocked: false,
  recoveryConfigured: false,
  entryCount: 0,
})
const securitySettings = ref<SecuritySettings>({
  autoLockMinutes: 15,
  clipboardClearEnabled: true,
  clipboardClearSeconds: 30,
  closeWindowAction: 'ask',
})

const selectedCategory = ref<FilterCategory>('all')
const selectedEntryId = ref<string | null>(null)
const searchQuery = ref('')
const listSortOrder = ref<ListSortOrder>('recent')
const passwordGenApplyMode = ref(false)
const pendingApplyPassword = ref<string | null>(null)
const emailBackupSettings = ref<EmailBackupSettings>({
  recipientEmail: '',
  frequency: 'manual',
  smtp: {
    host: '',
    port: 465,
    secure: true,
    username: '',
    hasPassword: false,
  },
  lastBackup: {
    at: null,
    entryCount: 0,
    sizeBytes: 0,
    status: 'never',
  },
})
const scheduledBackupPromptOpen = ref(false)
const entries = ref<PasswordEntry[]>([])
const vaultCategories = ref<VaultCategory[]>([])
const vaultTags = ref<VaultTag[]>([])
const sidebarCategoryOrder = ref<string[]>(['all', 'favorite'])
const isCreating = ref(false)
const DETAIL_COLLAPSED_STORAGE_KEY = 'pwdbook-detail-collapsed'
const detailCollapsed = ref(localStorage.getItem(DETAIL_COLLAPSED_STORAGE_KEY) === 'true')
const loading = ref(false)
const errorMessage = ref('')
const lastActivityAt = ref(Date.now())

const systemCategories = computed(() => [
  {
    id: 'all' as const,
    label: i18n.global.t('common.all'),
    icon: 'LayoutGrid',
    count: entries.value.length,
  },
  {
    id: 'favorite' as const,
    label: i18n.global.t('common.favorite'),
    icon: 'Star',
    count: entries.value.filter((entry) => entry.isFavorite).length,
  },
])

type SidebarCategoryItem = {
  id: string
  label: string
  icon: string
  count: number
}

const customCategories = computed(() =>
  vaultCategories.value.map((category) => ({
    id: category.id,
    label: category.name,
    icon: category.icon,
    count: entries.value.filter((entry) => entry.categoryId === category.id).length,
  })),
)

function buildDefaultSidebarOrder(categoryIds: string[]): string[] {
  return ['all', 'favorite', ...categoryIds]
}

function mergeSidebarOrder(stored: string[], categoryIds: string[]): string[] {
  const valid = new Set(['all', 'favorite', ...categoryIds])
  const merged: string[] = []
  for (const id of stored) {
    if (valid.has(id) && !merged.includes(id)) {
      merged.push(id)
    }
  }
  for (const id of buildDefaultSidebarOrder(categoryIds)) {
    if (!merged.includes(id)) {
      merged.push(id)
    }
  }
  return merged
}

const categories = computed(() => {
  const lookup = new Map<string, SidebarCategoryItem>()
  systemCategories.value.forEach((category) => lookup.set(category.id, category))
  customCategories.value.forEach((category) => lookup.set(category.id, category))
  return sidebarCategoryOrder.value
    .map((id) => lookup.get(id))
    .filter((category): category is SidebarCategoryItem => Boolean(category))
})

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
    return sorted.sort((a, b) =>
      a.title.localeCompare(b.title, i18n.global.locale.value),
    )
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
  errorMessage.value = parseErrorMessage(error)
}

function clearError(): void {
  errorMessage.value = ''
}

async function refreshCategories(): Promise<void> {
  const [categories, storedOrder] = await Promise.all([
    vaultApi.listCategories(),
    vaultApi.getSidebarCategoryOrder(),
  ])
  vaultCategories.value = categories
  sidebarCategoryOrder.value = mergeSidebarOrder(
    storedOrder,
    categories.map((category) => category.id),
  )
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

async function refreshTags(): Promise<void> {
  vaultTags.value = await vaultApi.listTags()
}

async function refreshVaultData(): Promise<void> {
  await Promise.all([refreshCategories(), refreshEntries(), refreshTags()])
}

async function bootstrap(): Promise<void> {
  loading.value = true
  try {
    vaultStatus.value = await vaultApi.getVaultStatus()
    securitySettings.value = await vaultApi.getSettings()
    if (vaultStatus.value.unlocked) {
      await refreshVaultData()
      await loadEmailBackupSettings()
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
    await refreshCategories()
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
    await loadEmailBackupSettings()
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

async function refreshVaultStatus(): Promise<void> {
  vaultStatus.value = await vaultApi.getVaultStatus()
}

async function enterVault(): Promise<void> {
  await refreshVaultData()
  screen.value = 'vault'
  touchActivity()
}

async function createRecoveryKey(): Promise<string | null> {
  loading.value = true
  clearError()
  try {
    const result = await vaultApi.createRecoveryKey()
    await refreshVaultStatus()
    return result.recoveryKey
  } catch (error) {
    setError(error)
    return null
  } finally {
    loading.value = false
  }
}

async function regenerateRecoveryKey(masterPassword: string): Promise<string | null> {
  loading.value = true
  clearError()
  try {
    const result = await vaultApi.regenerateRecoveryKey(masterPassword)
    await refreshVaultStatus()
    return result.recoveryKey
  } catch (error) {
    setError(error)
    return null
  } finally {
    loading.value = false
  }
}

async function clearRecoveryKey(): Promise<boolean> {
  loading.value = true
  clearError()
  try {
    vaultStatus.value = await vaultApi.clearRecoveryKey()
    return true
  } catch (error) {
    setError(error)
    return false
  } finally {
    loading.value = false
  }
}

async function resetMasterPasswordWithRecovery(
  recoveryKey: string,
  newMasterPassword: string,
  confirmPassword: string,
): Promise<boolean> {
  loading.value = true
  clearError()
  try {
    vaultStatus.value = await vaultApi.resetMasterPasswordWithRecovery({
      recoveryKey,
      newMasterPassword,
      confirmPassword,
    })
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

async function resetVaultFromLock(): Promise<boolean> {
  loading.value = true
  clearError()
  try {
    vaultStatus.value = await vaultApi.resetVault()
    entries.value = []
    vaultCategories.value = []
    selectedEntryId.value = null
    isCreating.value = false
    screen.value = 'lock'
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
  vaultTags.value = []
  selectedEntryId.value = null
  isCreating.value = false
  screen.value = 'lock'
}

function navigateTo(next: AppScreen, tab: SettingsTab = 'security'): void {
  if (next !== 'password-gen') {
    passwordGenApplyMode.value = false
  }
  screen.value = next
  if (next === 'settings') settingsTab.value = tab
  touchActivity()
}

function openEmailBackup(): void {
  navigateTo('email-backup')
  void loadEmailBackupSettings()
}

function openPasswordGen(apply = false): void {
  passwordGenApplyMode.value = apply
  screen.value = 'password-gen'
  touchActivity()
}

function applyGeneratedPassword(password: string): void {
  pendingApplyPassword.value = password
  passwordGenApplyMode.value = false
  screen.value = 'vault'
  touchActivity()
}

function consumePendingApplyPassword(): string | null {
  const password = pendingApplyPassword.value
  pendingApplyPassword.value = null
  return password
}

function openScheduledBackupPrompt(): void {
  scheduledBackupPromptOpen.value = true
}

function closeScheduledBackupPrompt(): void {
  scheduledBackupPromptOpen.value = false
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
  expandDetailPanel()
  touchActivity()
}

function expandDetailPanel(): void {
  detailCollapsed.value = false
  localStorage.setItem(DETAIL_COLLAPSED_STORAGE_KEY, 'false')
}

function setDetailCollapsed(collapsed: boolean): void {
  detailCollapsed.value = collapsed
  localStorage.setItem(DETAIL_COLLAPSED_STORAGE_KEY, String(collapsed))
}

function startCreateEntry(): void {
  isCreating.value = true
  selectedEntryId.value = null
  expandDetailPanel()
  touchActivity()
}

function cancelCreateEntry(): void {
  isCreating.value = false
  selectedEntryId.value = filteredEntries.value[0]?.id ?? null
  setDetailCollapsed(true)
  touchActivity()
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
    showToast(id ? i18n.global.t('vault.saved') : i18n.global.t('vault.created'), 'success')
    return true
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
    return false
  } finally {
    loading.value = false
  }
}

function entryToInput(entry: PasswordEntry): PasswordEntryInput {
  return {
    title: entry.title,
    url: entry.url,
    username: entry.username,
    password: entry.password,
    note: entry.note,
    tags: [...entry.tags],
    categoryId: entry.categoryId,
    isFavorite: entry.isFavorite,
    displayIcon: entry.displayIcon ?? '',
  }
}

async function moveEntryToCategory(entryId: string, categoryId: string): Promise<boolean> {
  const entry = entries.value.find((item) => item.id === entryId)
  if (!entry || entry.categoryId === categoryId) return false

  const categoryName =
    vaultCategories.value.find((category) => category.id === categoryId)?.name ?? ''

  loading.value = true
  clearError()
  try {
    await vaultApi.updateEntry(entryId, { ...entryToInput(entry), categoryId })
    await refreshVaultData()
    touchActivity()
    showToast(
      categoryName
        ? i18n.global.t('vault.movedToCategory', { name: categoryName })
        : i18n.global.t('vault.saved'),
      'success',
    )
    return true
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
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

async function updateCategory(id: string, input: CategoryInput): Promise<boolean> {
  loading.value = true
  clearError()
  try {
    await vaultApi.updateCategory(id, input)
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

async function createTag(input: TagInput): Promise<boolean> {
  loading.value = true
  clearError()
  try {
    await vaultApi.createTag(input)
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

async function updateTag(oldName: string, input: TagInput): Promise<boolean> {
  loading.value = true
  clearError()
  try {
    await vaultApi.updateTag(oldName, input)
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

async function deleteTag(name: string): Promise<boolean> {
  loading.value = true
  clearError()
  try {
    await vaultApi.deleteTag(name)
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

async function reorderSidebarCategories(order: string[]): Promise<boolean> {
  clearError()
  try {
    vaultCategories.value = await vaultApi.reorderSidebarCategories(order)
    sidebarCategoryOrder.value = order
    touchActivity()
    return true
  } catch (error) {
    setError(error)
    return false
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

async function openEntryInBrowser(entry: PasswordEntry): Promise<void> {
  if (!entry.url.trim()) {
    showToast(i18n.global.t('vault.noUrlToOpen'), 'error')
    return
  }
  clearError()
  try {
    const target = buildUrlWithCredentialParams(
      entry.url,
      entry.username ?? '',
      entry.password ?? '',
    )
    await vaultApi.openExternal(target)
    await vaultApi.touchEntry(entry.id)
    await refreshEntries()
    touchActivity()
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  }
}

function createGeneratedPassword(options: Partial<PasswordGenOptions> = {}): string {
  return generatePasswordWithOptions({
    ...DEFAULT_PASSWORD_GEN_OPTIONS,
    ...options,
  })
}

async function loadEmailBackupSettings(): Promise<void> {
  try {
    emailBackupSettings.value = await vaultApi.getEmailBackupSettings()
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  }
}

async function updateEmailBackupSettings(partial: EmailBackupSettingsUpdate): Promise<void> {
  try {
    emailBackupSettings.value = await vaultApi.updateEmailBackupSettings(partial)
    touchActivity()
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
    throw error
  }
}

async function testEmailBackupConnection(): Promise<void> {
  await vaultApi.testEmailBackupConnection()
  touchActivity()
}

async function sendEmailBackup(masterPassword: string): Promise<void> {
  emailBackupSettings.value = await vaultApi.sendEmailBackup({ masterPassword })
  touchActivity()
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

async function exportDataAsExcel(): Promise<Uint8Array> {
  const bytes = await vaultApi.exportDataAsExcel()
  touchActivity()
  return bytes
}

async function exportDataAsCsv(formatId: string): Promise<string> {
  const csv = await vaultApi.exportDataAsCsv(formatId)
  touchActivity()
  return csv
}

async function previewImportData(sourceId: string, content: string) {
  return vaultApi.previewImport({ sourceId, content })
}

async function commitImportData(
  sourceId: string,
  entries: PasswordEntryInput[],
  categories?: VaultCategory[],
): Promise<number> {
  const count = await vaultApi.commitImport(
    cloneForIpc({ sourceId, entries, categories }),
  )
  await refreshVaultData()
  touchActivity()
  return count
}

async function resetAllData(): Promise<void> {
  await vaultApi.resetVault()
  vaultStatus.value = {
    initialized: false,
    unlocked: false,
    recoveryConfigured: false,
    entryCount: 0,
  }
  entries.value = []
  vaultCategories.value = []
  vaultTags.value = []
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
    vaultTags,
    isCreating,
    detailCollapsed,
    expandDetailPanel,
    setDetailCollapsed,
    loading,
    errorMessage,
    lastActivityAt,
    categories,
    systemCategories,
    customCategories,
    filteredEntries,
    displayEntries,
    selectedEntry,
    defaultCategoryId,
    bootstrap,
    setupVault,
    unlock,
    lock,
    enterVault,
    refreshVaultStatus,
    createRecoveryKey,
    regenerateRecoveryKey,
    clearRecoveryKey,
    resetMasterPasswordWithRecovery,
    resetVaultFromLock,
    navigateTo,
    selectCategory,
    selectEntry,
    startCreateEntry,
    cancelCreateEntry,
    getCreateDefaultCategoryId,
    saveEntry,
    moveEntryToCategory,
    removeEntry,
    toggleFavorite,
    createCategory,
    updateCategory,
    deleteCategory,
    createTag,
    updateTag,
    deleteTag,
    reorderSidebarCategories,
    copyUsername,
    copyPassword,
    copyEntryData,
    openEntryInBrowser,
    createGeneratedPassword,
    passwordGenApplyMode,
    pendingApplyPassword,
    openPasswordGen,
    openEmailBackup,
    applyGeneratedPassword,
    consumePendingApplyPassword,
    emailBackupSettings,
    loadEmailBackupSettings,
    updateEmailBackupSettings,
    testEmailBackupConnection,
    sendEmailBackup,
    scheduledBackupPromptOpen,
    openScheduledBackupPrompt,
    closeScheduledBackupPrompt,
    updateSecuritySettings,
    exportData,
    exportDataAsExcel,
    exportDataAsCsv,
    previewImportData,
    commitImportData,
    resetAllData,
    switchSettingsTab,
    setListSortOrder,
    touchActivity,
    clearError,
  }
}
