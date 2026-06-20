import { ref, computed, nextTick } from 'vue'
import { i18n } from '@/i18n'
import { vaultApi } from '@/services/vaultApi'
import { entryMatchesSearch } from '@/shared/entrySearch'
import {
  normalizeExternalUrl,
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
  TrashedEntry,
  VaultStatus,
} from '@/types'
import type {
  SyncMergeResult,
  SyncStatus,
  WifiSyncClientPullPayload,
  WifiSyncPairingInfo,
  WifiSyncServerStatus,
  WifiSyncSettings,
  FolderSyncSettings,
  FolderSyncStatus,
} from '@/shared/syncTypes'

const screen = ref<AppScreen>('lock')
const settingsTab = ref<SettingsTab>('security')
const vaultStatus = ref<VaultStatus>({
  initialized: false,
  unlocked: false,
  recoveryConfigured: false,
  entryCount: 0,
  trashCount: 0,
})
const securitySettings = ref<SecuritySettings>({
  autoLockMinutes: 15,
  clipboardClearEnabled: true,
  clipboardClearSeconds: 30,
  closeWindowAction: 'ask',
  browserFillEnabled: false,
  quickBarEnabled: true,
  quickBarAccelerator: 'Alt+Shift+P',
  mainWindowShortcutEnabled: true,
  mainWindowShortcutAccelerator: 'Alt+Shift+M',
  trashRetentionDays: 30,
  launchAtLoginEnabled: false,
})

const selectedCategory = ref<FilterCategory>('all')
const selectedTagFilters = ref<string[]>([])
const selectedEntryId = ref<string | null>(null)
const searchQuery = ref('')
const listSortOrder = ref<ListSortOrder>('title')
const passwordGenApplyMode = ref(false)
const pendingApplyPassword = ref<string | null>(null)
const wifiSyncSettings = ref<WifiSyncSettings>({
  serverEnabled: false,
  accessPassword: '',
  port: 8765,
  pairedDevices: [],
})
const syncStatus = ref<SyncStatus>({
  deviceId: '',
  revision: 0,
  lastSyncedAt: null,
  lastSyncError: null,
})
const wifiSyncServerStatus = ref<WifiSyncServerStatus>({
  running: false,
  port: null,
  host: null,
  accessPassword: '',
  certificateFingerprint: '',
  verificationCode: '',
  lastPublishedAt: null,
  lastPublishedRevision: 0,
  bundleSizeBytes: 0,
})
const folderSyncSettings = ref<FolderSyncSettings>({
  enabled: false,
  folderPath: null,
  autoSync: true,
})
const folderSyncStatus = ref<FolderSyncStatus>({
  connected: false,
  folderPath: null,
  autoSync: true,
  bundleExists: false,
  bundleSizeBytes: 0,
  bundleModifiedAt: null,
  lastPublishedAt: null,
  lastPublishedRevision: 0,
})

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
const trashEntries = ref<TrashedEntry[]>([])
const vaultCategories = ref<VaultCategory[]>([])
const vaultTags = ref<VaultTag[]>([])
const sidebarCategoryOrder = ref<string[]>(['all', 'favorite', 'attachments'])
const isCreating = ref(false)
const DETAIL_COLLAPSED_STORAGE_KEY = 'pwdbook-detail-collapsed'
const detailCollapsed = ref(localStorage.getItem(DETAIL_COLLAPSED_STORAGE_KEY) === 'true')
const detachedDetailOpen = ref(false)
let skipDetailAutoCollapseOnce = false
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
  {
    id: 'attachments' as const,
    label: i18n.global.t('common.attachments'),
    icon: 'Paperclip',
    count: entries.value.filter((entry) => entry.attachmentCount > 0).length,
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
  return ['all', 'favorite', 'attachments', ...categoryIds]
}

function mergeSidebarOrder(stored: string[], categoryIds: string[]): string[] {
  const valid = new Set(['all', 'favorite', 'attachments', ...categoryIds])
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
        : selectedCategory.value === 'attachments'
          ? entry.attachmentCount > 0
          : entry.categoryId === selectedCategory.value)
    const matchTag =
      selectedTagFilters.value.length === 0 ||
      selectedTagFilters.value.every((filterTag) => {
        const normalized = filterTag.trim().toLowerCase()
        return entry.tags.some((tag) => tag.trim().toLowerCase() === normalized)
      })
    const matchSearch = !q || entryMatchesSearch(entry, q)
    return matchCategory && matchTag && matchSearch
  })
})

const selectedEntry = computed(() => {
  if (isCreating.value || !selectedEntryId.value) return null
  return entries.value.find((entry) => entry.id === selectedEntryId.value) ?? null
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

function notifyOtherWindowsVaultChanged(): void {
  window.electronAPI?.notifyVaultDataChanged?.()
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

function openSync(): void {
  navigateTo('sync')
}

function openWifiSync(): void {
  navigateTo('wifi-sync')
  void loadWifiSyncState()
}

function openFolderSync(): void {
  navigateTo('folder-sync')
  void loadFolderSyncState()
}

async function loadSyncState(): Promise<void> {
  if (vaultStatus.value.unlocked) {
    syncStatus.value = await vaultApi.getSyncStatus()
  }
}

async function loadWifiSyncState(): Promise<void> {
  wifiSyncSettings.value = await vaultApi.getWifiSyncSettings()
  wifiSyncServerStatus.value = await vaultApi.getWifiSyncServerStatus()
  if (vaultStatus.value.unlocked) {
    syncStatus.value = await vaultApi.getSyncStatus()
  }
}

async function getWifiSyncVerificationCode(fingerprint: string): Promise<string> {
  return vaultApi.getWifiSyncVerificationCode(fingerprint)
}

async function startWifiSyncServer(): Promise<WifiSyncServerStatus> {
  wifiSyncServerStatus.value = await vaultApi.startWifiSyncServer()
  wifiSyncSettings.value = await vaultApi.getWifiSyncSettings()
  touchActivity()
  return wifiSyncServerStatus.value
}

async function stopWifiSyncServer(): Promise<WifiSyncServerStatus> {
  wifiSyncServerStatus.value = await vaultApi.stopWifiSyncServer()
  wifiSyncSettings.value = await vaultApi.getWifiSyncSettings()
  touchActivity()
  return wifiSyncServerStatus.value
}

async function refreshWifiSyncPairing(): Promise<WifiSyncPairingInfo> {
  return vaultApi.getWifiSyncPairingInfo()
}

async function regenerateWifiSyncAccessPassword(): Promise<string> {
  const password = await vaultApi.regenerateWifiSyncAccessPassword()
  await loadWifiSyncState()
  touchActivity()
  return password
}

async function discoverWifiSyncServers() {
  return vaultApi.discoverWifiSyncServers()
}

async function pullWifiSyncMerge(payload: WifiSyncClientPullPayload): Promise<SyncMergeResult> {
  const result = await vaultApi.pullWifiSyncMerge(payload)
  await refreshVaultData()
  await loadWifiSyncState()
  touchActivity()
  return result
}

async function pullWifiSyncMergeQr(
  qrPayload: string,
  masterPassword: string,
  deviceName?: string,
): Promise<SyncMergeResult> {
  const result = await vaultApi.pullWifiSyncMergeQr({ qrPayload, masterPassword, deviceName })
  await refreshVaultData()
  await loadWifiSyncState()
  touchActivity()
  return result
}

async function loadFolderSyncState(): Promise<void> {
  folderSyncSettings.value = await vaultApi.getFolderSyncSettings()
  folderSyncStatus.value = await vaultApi.getFolderSyncStatus()
  if (vaultStatus.value.unlocked) {
    syncStatus.value = await vaultApi.getSyncStatus()
  }
}

async function pickFolderSyncDirectory(): Promise<string | null> {
  return vaultApi.pickFolderSyncDirectory()
}

async function connectFolderSync(folderPath: string, masterPassword: string): Promise<SyncMergeResult> {
  const result = await vaultApi.connectFolderSync({ folderPath, masterPassword })
  await refreshVaultData()
  await loadFolderSyncState()
  touchActivity()
  return result
}

async function disconnectFolderSync(): Promise<void> {
  folderSyncSettings.value = await vaultApi.disconnectFolderSync()
  await loadFolderSyncState()
  touchActivity()
}

async function updateFolderSyncAutoSync(autoSync: boolean): Promise<void> {
  folderSyncSettings.value = await vaultApi.updateFolderSyncSettings({ autoSync })
  folderSyncStatus.value = await vaultApi.getFolderSyncStatus()
  touchActivity()
}

async function syncFolderNow(masterPassword: string): Promise<SyncMergeResult> {
  const result = await vaultApi.syncFolderNow(masterPassword)
  await refreshVaultData()
  await loadFolderSyncState()
  touchActivity()
  return result
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
  selectedTagFilters.value = []
  isCreating.value = false
  selectedEntryId.value = null
  touchActivity()
}

function toggleTagFilter(tag: string): void {
  const normalized = tag.trim()
  if (!normalized) return

  const lower = normalized.toLowerCase()
  const index = selectedTagFilters.value.findIndex(
    (item) => item.trim().toLowerCase() === lower,
  )

  if (index >= 0) {
    selectedTagFilters.value = selectedTagFilters.value.filter((_, i) => i !== index)
  } else {
    selectedTagFilters.value = [...selectedTagFilters.value, normalized]
  }

  isCreating.value = false
  selectedEntryId.value = filteredEntries.value[0]?.id ?? null
  touchActivity()
}

function clearTagFilters(): void {
  if (selectedTagFilters.value.length === 0) return
  selectedTagFilters.value = []
  isCreating.value = false
  selectedEntryId.value = filteredEntries.value[0]?.id ?? null
  touchActivity()
}

function openPasswordHealth(): void {
  screen.value = 'password-health'
  touchActivity()
}

function selectEntry(id: string): void {
  isCreating.value = false
  selectedEntryId.value = id
  window.electronAPI?.detailWindowSelectEntry?.(id)
  if (!detachedDetailOpen.value) {
    expandDetailPanel()
  }
  touchActivity()
}

async function openDetachedDetail(): Promise<boolean> {
  const id = selectedEntryId.value
  if (!id) return false
  const ok = await window.electronAPI?.openDetailWindow?.(id)
  if (ok) {
    skipDetailAutoCollapseOnce = true
    expandDetailPanel()
    detachedDetailOpen.value = true
  }
  return ok ?? false
}

function handleDetailWindowOpened(): void {
  detachedDetailOpen.value = true
}

function handleDetailWindowClosed(): void {
  detachedDetailOpen.value = false
  skipDetailAutoCollapseOnce = true
  expandDetailPanel()
  void nextTick(() => {
    expandDetailPanel()
  })
}

function consumeSkipDetailAutoCollapse(): boolean {
  if (!skipDetailAutoCollapseOnce) return false
  skipDetailAutoCollapseOnce = false
  return true
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
  if (detachedDetailOpen.value) {
    window.electronAPI?.closeDetailWindow?.()
    detachedDetailOpen.value = false
  }
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
  if (selectedCategory.value !== 'all' && selectedCategory.value !== 'favorite' && selectedCategory.value !== 'attachments') {
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
    notifyOtherWindowsVaultChanged()
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
    localProgramPath: entry.localProgramPath ?? '',
    totpSecret: entry.totpSecret ?? '',
    customFields: [...(entry.customFields ?? [])],
  }
}

async function duplicateEntry(entry: PasswordEntry): Promise<boolean> {
  const input = entryToInput(entry)
  input.title = `${entry.title}${i18n.global.t('vault.duplicateTitleSuffix')}`

  loading.value = true
  clearError()
  try {
    const saved = await vaultApi.createEntry(input)
    isCreating.value = false
    selectedEntryId.value = saved.id
    expandDetailPanel()
    await refreshVaultData()
    notifyOtherWindowsVaultChanged()
    touchActivity()
    showToast(i18n.global.t('vault.duplicated'), 'success')
    return true
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
    return false
  } finally {
    loading.value = false
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
    notifyOtherWindowsVaultChanged()
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
    await refreshVaultStatus()
    notifyOtherWindowsVaultChanged()
    showToast(i18n.global.t('vault.movedToTrash'), 'success')
    touchActivity()
    return true
  } catch (error) {
    setError(error)
    return false
  } finally {
    loading.value = false
  }
}

async function refreshTrashEntries(): Promise<void> {
  trashEntries.value = await vaultApi.listTrashedEntries()
  await refreshVaultStatus()
}

async function openTrash(): Promise<void> {
  screen.value = 'trash'
  await refreshTrashEntries()
  touchActivity()
}

async function restoreTrashEntry(id: string): Promise<boolean> {
  clearError()
  try {
    await vaultApi.restoreTrashEntry(id)
    await refreshTrashEntries()
    await refreshVaultData()
    showToast(i18n.global.t('trash.restored'), 'success')
    touchActivity()
    return true
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
    return false
  }
}

async function restoreAllTrash(): Promise<boolean> {
  clearError()
  try {
    const count = await vaultApi.restoreAllTrashEntries()
    await refreshTrashEntries()
    await refreshVaultData()
    if (count > 0) {
      showToast(i18n.global.t('trash.restoredAll', { count }), 'success')
    }
    touchActivity()
    return true
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
    return false
  }
}

async function permanentlyDeleteTrash(id: string): Promise<boolean> {
  clearError()
  try {
    await vaultApi.permanentlyDeleteTrashEntry(id)
    await refreshTrashEntries()
    showToast(i18n.global.t('trash.deletedPermanent'), 'success')
    touchActivity()
    return true
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
    return false
  }
}

async function emptyTrash(): Promise<boolean> {
  clearError()
  try {
    const count = await vaultApi.emptyTrash()
    await refreshTrashEntries()
    if (count > 0) {
      showToast(i18n.global.t('trash.emptied', { count }), 'success')
    }
    touchActivity()
    return true
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
    return false
  }
}

async function toggleFavorite(id: string): Promise<void> {
  clearError()
  try {
    await vaultApi.toggleFavorite(id)
    await refreshVaultData()
    notifyOtherWindowsVaultChanged()
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
    notifyOtherWindowsVaultChanged()
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
    notifyOtherWindowsVaultChanged()
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
    notifyOtherWindowsVaultChanged()
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
    notifyOtherWindowsVaultChanged()
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
    notifyOtherWindowsVaultChanged()
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

async function openLocalProgramForEntry(entry: PasswordEntry): Promise<void> {
  const programPath = entry.localProgramPath?.trim() ?? ''
  if (!programPath) return
  clearError()
  try {
    await vaultApi.openLocalProgram(programPath)
    await vaultApi.touchEntry(entry.id)
    await refreshEntries()
    touchActivity()
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  }
}

async function openEntryInBrowser(entry: PasswordEntry): Promise<void> {
  if (!entry.url.trim()) {
    showToast(i18n.global.t('vault.noUrlToOpen'), 'error')
    return
  }
  clearError()
  try {
    const target = normalizeExternalUrl(entry.url)
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
    trashCount: 0,
  }
  entries.value = []
  trashEntries.value = []
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
    selectedTagFilters,
    selectedEntryId,
    searchQuery,
    listSortOrder,
    entries,
    trashEntries,
    vaultCategories,
    vaultTags,
    isCreating,
    detailCollapsed,
    detachedDetailOpen,
    expandDetailPanel,
    setDetailCollapsed,
    openDetachedDetail,
    handleDetailWindowOpened,
    handleDetailWindowClosed,
    consumeSkipDetailAutoCollapse,
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
    refreshVaultData,
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
    toggleTagFilter,
    clearTagFilters,
    selectEntry,
    startCreateEntry,
    cancelCreateEntry,
    getCreateDefaultCategoryId,
    saveEntry,
    duplicateEntry,
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
    openLocalProgramForEntry,
    createGeneratedPassword,
    passwordGenApplyMode,
    pendingApplyPassword,
    openPasswordGen,
    openPasswordHealth,
    openEmailBackup,
    openSync,
    openWifiSync,
    openFolderSync,
    wifiSyncSettings,
    wifiSyncServerStatus,
    folderSyncSettings,
    folderSyncStatus,
    syncStatus,
    loadSyncState,
    loadWifiSyncState,
    loadFolderSyncState,
    getWifiSyncVerificationCode,
    startWifiSyncServer,
    stopWifiSyncServer,
    refreshWifiSyncPairing,
    regenerateWifiSyncAccessPassword,
    discoverWifiSyncServers,
    pullWifiSyncMerge,
    pullWifiSyncMergeQr,
    pickFolderSyncDirectory,
    connectFolderSync,
    disconnectFolderSync,
    updateFolderSyncAutoSync,
    syncFolderNow,
    openTrash,
    refreshTrashEntries,
    restoreTrashEntry,
    restoreAllTrash,
    permanentlyDeleteTrash,
    emptyTrash,
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
