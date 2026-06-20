<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Star, Trash2, Copy, Eye, EyeOff, Sparkles, Tags, X, Shield, SquareArrowOutUpRight, Paperclip, FileText } from 'lucide-vue-next'
import PanelEdge from '@/components/PanelEdge.vue'
import {
  generateTotpCode,
  getTotpRemainingSeconds,
  isValidTotpSecret,
  normalizeTotpSecret,
} from '@/shared/totp'
import { showToast } from '@/composables/useToast'
import CategoryIconView from '@/components/CategoryIconView.vue'
import IconPickerModal from '@/components/IconPickerModal.vue'
import { UiInput, UiSelect, UiButton, UiCheckbox, UiModal } from '@/components/ui'
import { useTheme } from '@/composables/useTheme'
import { useAppState } from '@/composables/useAppState'
import { getAvatarMeta, parseErrorMessage } from '@/shared/utils'
import { vaultApi } from '@/services/vaultApi'
import type { PasswordEntryInput, EntryAttachmentMeta } from '@/types'

const props = withDefaults(
  defineProps<{
    detached?: boolean
  }>(),
  {
    detached: false,
  },
)

const WIDTH_STORAGE_KEY = 'pwdbook-detail-width'
const DETAIL_DEFAULT_WIDTH = 360
const DETAIL_COLLAPSED_WIDTH = 40
const DETAIL_MIN_WIDTH_FALLBACK = 400
const DETAIL_MAX_WIDTH_FALLBACK = 560
const LIST_COLUMN_MIN_WIDTH_FALLBACK = 240

function readCssPxVar(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readDetailMinWidth(): number {
  return readCssPxVar('--detail-min-width', DETAIL_MIN_WIDTH_FALLBACK)
}

function readDetailMaxWidth(): number {
  return readCssPxVar('--detail-max-width', DETAIL_MAX_WIDTH_FALLBACK)
}

const {
  selectedEntry,
  isCreating,
  loading,
  vaultCategories,
  saveEntry,
  removeEntry,
  toggleFavorite,
  copyUsername,
  copyPassword,
  cancelCreateEntry,
  getCreateDefaultCategoryId,
  detailCollapsed,
  setDetailCollapsed,
  createGeneratedPassword,
  vaultTags,
  openDetachedDetail,
  detachedDetailOpen,
  consumeSkipDetailAutoCollapse,
  refreshVaultData,
} = useAppState()

const { t } = useI18n()
const { isAnimalIsland } = useTheme()

function readListColumnMinWidth(): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--list-column-min-width')
    .trim()
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : LIST_COLUMN_MIN_WIDTH_FALLBACK
}

function getMaxPanelWidth(): number {
  const body = document.querySelector('.vault-body')
  if (!body) return readDetailMaxWidth()
  const sidebar = document.querySelector('.sidebar')
  const sidebarWidth = sidebar?.getBoundingClientRect().width ?? 0
  const reserved = sidebarWidth + readListColumnMinWidth()
  const available = body.getBoundingClientRect().width - reserved
  return Math.min(readDetailMaxWidth(), Math.max(0, Math.floor(available)))
}

function clampPanelWidth(): void {
  if (detailCollapsed.value) return
  const minW = readDetailMinWidth()
  const max = getMaxPanelWidth()
  const skipAutoCollapse = consumeSkipDetailAutoCollapse()
  if (max < minW) {
    if (!skipAutoCollapse) {
      setDetailCollapsed(true)
    }
    return
  }
  panelWidth.value = Math.min(max, Math.max(minW, panelWidth.value))
}

function loadPanelWidth(): number {
  const stored = Number(localStorage.getItem(WIDTH_STORAGE_KEY))
  const base = Number.isFinite(stored) ? stored : DETAIL_DEFAULT_WIDTH
  const minW = readDetailMinWidth()
  const maxW = readDetailMaxWidth()
  return Math.min(maxW, Math.max(minW, base))
}

const panelWidth = ref(loadPanelWidth())
const isResizing = ref(false)
const isEditing = ref(false)
const showPassword = ref(false)
const showTotpSecret = ref(false)
const showIconPicker = ref(false)
const draft = ref<PasswordEntryInput>({
  title: '',
  url: '',
  username: '',
  password: '',
  note: '',
  tags: [],
  categoryId: '',
  isFavorite: false,
  displayIcon: '',
  localProgramPath: '',
  totpSecret: '',
})

const totpCode = ref('')
const totpRemaining = ref(30)
let totpTimer: ReturnType<typeof setInterval> | null = null

const attachments = ref<EntryAttachmentMeta[]>([])
const attachmentsLoading = ref(false)
const attachmentDeleteConfirm = ref<EntryAttachmentMeta | null>(null)
const showAttachmentDeleteConfirm = ref(false)

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function loadAttachments(): Promise<void> {
  const entryId = selectedEntry.value?.id
  if (!entryId || isCreating.value) {
    attachments.value = []
    return
  }
  attachmentsLoading.value = true
  try {
    attachments.value = await vaultApi.listAttachments(entryId)
  } catch (error) {
    attachments.value = []
    showToast(parseErrorMessage(error), 'error')
  } finally {
    attachmentsLoading.value = false
  }
}

async function handleAddAttachment(): Promise<void> {
  const entryId = selectedEntry.value?.id
  if (!entryId) return
  try {
    const added = await vaultApi.addAttachment(entryId)
    if (!added) return
    await loadAttachments()
    await refreshVaultData()
    showToast(t('detail.attachmentAdded'), 'success')
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  }
}

function handleDeleteAttachment(attachmentId: string): void {
  const item = attachments.value.find((attachment) => attachment.id === attachmentId)
  if (!item) return
  attachmentDeleteConfirm.value = item
  showAttachmentDeleteConfirm.value = true
}

function cancelAttachmentDeleteConfirm(): void {
  showAttachmentDeleteConfirm.value = false
  attachmentDeleteConfirm.value = null
}

async function confirmDeleteAttachment(): Promise<void> {
  const item = attachmentDeleteConfirm.value
  if (!item) return
  try {
    await vaultApi.deleteAttachment(item.id)
    await loadAttachments()
    await refreshVaultData()
    showToast(t('detail.attachmentDeleted'), 'success')
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  } finally {
    cancelAttachmentDeleteConfirm()
  }
}

async function handleOpenAttachment(attachmentId: string): Promise<void> {
  try {
    const errorMessage = await vaultApi.openAttachment(attachmentId)
    if (errorMessage) {
      showToast(errorMessage, 'error')
      return
    }
    showToast(t('detail.attachmentOpened'), 'success')
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  }
}

async function handleSaveAttachmentAs(attachmentId: string): Promise<void> {
  try {
    const saved = await vaultApi.saveAttachmentAs(attachmentId)
    if (saved) showToast(t('detail.attachmentSaved'), 'success')
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  }
}

async function refreshTotpDisplay(): Promise<void> {
  const secret = normalizeTotpSecret(draft.value.totpSecret ?? '')
  if (!secret || !isValidTotpSecret(secret)) {
    totpCode.value = ''
    totpRemaining.value = 30
    return
  }
  try {
    totpCode.value = await generateTotpCode(secret)
    totpRemaining.value = getTotpRemainingSeconds()
  } catch {
    totpCode.value = ''
  }
}

const hasValidTotp = computed(() => isValidTotpSecret(draft.value.totpSecret ?? ''))

const categoryOptions = computed(() =>
  vaultCategories.value.map((category) => ({
    value: category.id,
    label: category.name,
  })),
)

const showTagPicker = ref(false)
const tagPickerTriggerRef = ref<HTMLButtonElement | null>(null)
const tagPickerMenuStyle = ref<Record<string, string>>({})
const detailBodyRef = ref<HTMLElement | null>(null)

let tagPickerOutsideHandler: ((event: MouseEvent) => void) | null = null

const draftTags = computed({
  get: () => draft.value.tags ?? [],
  set: (tags: string[]) => {
    draft.value.tags = tags
  },
})

function tagKey(name: string): string {
  return name.trim().toLowerCase()
}

const availableVaultTags = computed(() => {
  const selected = new Set(draftTags.value.map(tagKey))
  return vaultTags.value.filter((tag) => !selected.has(tagKey(tag.name)))
})

const avatar = computed(() => getAvatarMeta(draft.value.title || t('detail.newEntry')))

const strengthLevel = computed(() => {
  const len = draft.value.password.length
  if (len >= 16) return { label: t('detail.strengthStrong'), bars: 3 }
  if (len >= 10) return { label: t('detail.strengthMedium'), bars: 2 }
  if (len >= 1) return { label: t('detail.strengthWeak'), bars: 1 }
  return { label: t('detail.strengthNone'), bars: 0 }
})

const shellWidth = computed(() =>
  detailCollapsed.value ? `${DETAIL_COLLAPSED_WIDTH}px` : `${panelWidth.value}px`,
)

const shellStyle = computed(() => ({
  width: shellWidth.value,
  maxWidth: shellWidth.value,
  flexBasis: shellWidth.value,
}))

const formEditable = computed(() => isCreating.value || isEditing.value)

function resetDraftFromEntry(): void {
  showTotpSecret.value = false
  if (isCreating.value || !selectedEntry.value) {
    draft.value = {
      title: '',
      url: '',
      username: '',
      password: '',
      note: '',
      tags: [],
      categoryId: getCreateDefaultCategoryId(),
      isFavorite: false,
      displayIcon: '',
      localProgramPath: '',
      totpSecret: '',
    }
    closeTagPicker()
    refreshTotpDisplay()
    return
  }

  draft.value = {
    title: selectedEntry.value.title,
    url: selectedEntry.value.url,
    username: selectedEntry.value.username,
    password: selectedEntry.value.password,
    note: selectedEntry.value.note,
    tags: [...selectedEntry.value.tags],
    categoryId: selectedEntry.value.categoryId,
    isFavorite: selectedEntry.value.isFavorite,
    displayIcon: selectedEntry.value.displayIcon ?? '',
    localProgramPath: selectedEntry.value.localProgramPath ?? '',
    totpSecret: selectedEntry.value.totpSecret ?? '',
  }
  closeTagPicker()
  refreshTotpDisplay()
}

watch(
  () => [selectedEntry.value?.id, isCreating.value] as const,
  ([entryId, creating], oldValue) => {
    const prevEntryId = oldValue?.[0]
    const prevCreating = oldValue?.[1]
    if (oldValue !== undefined) {
      const entryChanged = entryId !== prevEntryId
      const creatingChanged = creating !== prevCreating
      if (!entryChanged && !creatingChanged) return
    }

    if (!creating) isEditing.value = false
    resetDraftFromEntry()
    void loadAttachments()
  },
  { immediate: true },
)

function startEditing(): void {
  isEditing.value = true
}

function cancelEditing(): void {
  isEditing.value = false
  showPassword.value = false
  showTotpSecret.value = false
  resetDraftFromEntry()
}

function buildInput(): PasswordEntryInput {
  return {
    ...draft.value,
    tags: [...draftTags.value],
    totpSecret: normalizeTotpSecret(draft.value.totpSecret ?? ''),
  }
}

async function handleCopyTotp(): Promise<void> {
  if (!totpCode.value) return
  await window.electronAPI?.copySecret(totpCode.value, 0)
  showToast(t('detail.totpCopied'), 'success')
}

async function handleSave(): Promise<void> {
  const id = isCreating.value ? null : selectedEntry.value?.id ?? null
  const ok = await saveEntry(id, buildInput())
  if (ok && !isCreating.value) isEditing.value = false
}

async function handleDelete(): Promise<void> {
  if (!selectedEntry.value) return
  if (!window.confirm(t('vault.deleteConfirmSimple', { title: selectedEntry.value.title }))) return
  await removeEntry(selectedEntry.value.id)
}

async function handleToggleFavorite(): Promise<void> {
  if (!selectedEntry.value) return
  await toggleFavorite(selectedEntry.value.id)
}

async function handleCopyUrl(): Promise<void> {
  const url = (draft.value.url ?? '').trim()
  if (!url) return
  await copyUsername(url)
}

async function handleCopyUsername(): Promise<void> {
  if (!draft.value.username) return
  await copyUsername(draft.value.username)
}

async function handleCopyPassword(): Promise<void> {
  if (!selectedEntry.value || !draft.value.password) return
  await copyPassword(selectedEntry.value.id, draft.value.password)
}

function handleGeneratePassword(): void {
  draft.value.password = createGeneratedPassword()
}

function updateTagPickerPosition(): void {
  const trigger = tagPickerTriggerRef.value
  if (!trigger) return

  const rect = trigger.getBoundingClientRect()
  const menuWidth = 280
  const menuMaxHeight = 220
  const gap = 8
  const itemCount = Math.max(availableVaultTags.value.length, 1)
  const estimatedHeight = Math.min(menuMaxHeight, itemCount * 40 + 16)

  let left = rect.right - menuWidth
  left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8))

  const spaceAbove = rect.top - gap
  const spaceBelow = window.innerHeight - rect.bottom - gap
  const openAbove = spaceAbove >= estimatedHeight || spaceAbove >= spaceBelow

  let top = openAbove ? rect.top - estimatedHeight - gap : rect.bottom + gap
  top = Math.max(8, Math.min(top, window.innerHeight - estimatedHeight - 8))

  tagPickerMenuStyle.value = {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    width: `${menuWidth}px`,
    maxHeight: `${openAbove ? Math.min(menuMaxHeight, spaceAbove) : Math.min(menuMaxHeight, spaceBelow)}px`,
    zIndex: '10050',
  }
}

function unbindTagPickerOutsideClose(): void {
  if (!tagPickerOutsideHandler) return
  document.removeEventListener('mousedown', tagPickerOutsideHandler, true)
  tagPickerOutsideHandler = null
}

function bindTagPickerOutsideClose(): void {
  unbindTagPickerOutsideClose()
  tagPickerOutsideHandler = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null
    if (target?.closest('.tag-picker-menu--portal') || target?.closest('.tag-picker-trigger')) return
    closeTagPicker()
  }
  window.setTimeout(() => {
    if (!showTagPicker.value || !tagPickerOutsideHandler) return
    document.addEventListener('mousedown', tagPickerOutsideHandler, true)
  }, 0)
}

async function openTagPicker(): Promise<void> {
  showTagPicker.value = true
  await nextTick()
  updateTagPickerPosition()
  bindTagPickerOutsideClose()
}

function closeTagPicker(): void {
  showTagPicker.value = false
  unbindTagPickerOutsideClose()
}

function toggleTagPicker(): void {
  if (showTagPicker.value) {
    closeTagPicker()
    return
  }
  void openTagPicker()
}

function addTagFromVault(name: string): void {
  if (draftTags.value.some((tag) => tagKey(tag) === tagKey(name))) {
    closeTagPicker()
    return
  }
  draftTags.value = [...draftTags.value, name]
  closeTagPicker()
}

function removeTag(index: number): void {
  draftTags.value = draftTags.value.filter((_, i) => i !== index)
}

function onDetailBodyScroll(): void {
  if (!showTagPicker.value) return
  updateTagPickerPosition()
}

function onWindowResize(): void {
  if (!showTagPicker.value) return
  updateTagPickerPosition()
}

function handleIconSelect(icon: string): void {
  draft.value.displayIcon = icon
}

function handleIconClear(): void {
  draft.value.displayIcon = ''
}

function toggleCollapse(): void {
  setDetailCollapsed(!detailCollapsed.value)
}

async function handleOpenDetached(): Promise<void> {
  await openDetachedDetail()
}

function stopResize(): void {
  isResizing.value = false
  localStorage.setItem(WIDTH_STORAGE_KEY, String(panelWidth.value))
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  document.removeEventListener('pointermove', onResizeMove)
  document.removeEventListener('pointerup', stopResize)
  document.removeEventListener('pointercancel', stopResize)
}

function onResizeMove(event: PointerEvent): void {
  const shell = document.querySelector('.detail-shell') as HTMLElement | null
  if (!shell) return
  const rect = shell.getBoundingClientRect()
  const next = Math.round(rect.right - event.clientX)
  const minW = readDetailMinWidth()
  const max = getMaxPanelWidth()
  if (max < minW) return
  panelWidth.value = Math.min(max, Math.max(minW, next))
}

function onResizeStart(event: PointerEvent): void {
  if (detailCollapsed.value || event.button !== 0) return
  isResizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('pointermove', onResizeMove)
  document.addEventListener('pointerup', stopResize)
  document.addEventListener('pointercancel', stopResize)
}

watch(showTagPicker, (open) => {
  if (open) {
    window.addEventListener('resize', onWindowResize)
    detailBodyRef.value?.addEventListener('scroll', onDetailBodyScroll, { passive: true })
  } else {
    window.removeEventListener('resize', onWindowResize)
    detailBodyRef.value?.removeEventListener('scroll', onDetailBodyScroll)
    unbindTagPickerOutsideClose()
  }
})

function onVaultLayoutResize(): void {
  clampPanelWidth()
  if (showTagPicker.value) updateTagPickerPosition()
}

watch(() => draft.value.totpSecret, refreshTotpDisplay)

onMounted(() => {
  if (!props.detached) {
    clampPanelWidth()
    window.addEventListener('resize', onVaultLayoutResize)
  }
  refreshTotpDisplay()
  totpTimer = setInterval(refreshTotpDisplay, 1000)
})

onUnmounted(() => {
  if (totpTimer) clearInterval(totpTimer)
  stopResize()
  unbindTagPickerOutsideClose()
  window.removeEventListener('resize', onWindowResize)
  window.removeEventListener('resize', onVaultLayoutResize)
  detailBodyRef.value?.removeEventListener('scroll', onDetailBodyScroll)
})

const showPanel = computed(() => props.detached || isCreating.value || Boolean(selectedEntry.value))

watch(showPanel, (visible) => {
  if (visible && !props.detached) nextTick(() => clampPanelWidth())
})

watch(detailCollapsed, () => {
  if (!props.detached) nextTick(() => clampPanelWidth())
})
</script>

<template>
  <aside
    v-if="showPanel"
    class="detail-shell"
    :class="{
      detached: props.detached,
      collapsed: !props.detached && detailCollapsed,
      resizing: isResizing,
    }"
    :style="props.detached ? undefined : shellStyle"
  >
    <PanelEdge
      v-if="!props.detached"
      placement="before"
      :collapsed="detailCollapsed"
      :resizing="isResizing"
      :expand-label="t('detail.expand')"
      :collapse-label="t('detail.collapse')"
      @toggle="toggleCollapse"
      @resize-start="onResizeStart"
    />

    <div
      v-if="props.detached || !detailCollapsed"
      class="detail-main"
    >
      <div class="detail-header">
        <div class="header-main">
          <button
            type="button"
            class="avatar avatar-btn"
            :class="{ 'avatar-btn--readonly': !formEditable }"
            :title="formEditable ? t('detail.pickIcon') : undefined"
            :aria-label="t('detail.pickIcon')"
            :disabled="!formEditable"
            @click="showIconPicker = true"
          >
            <CategoryIconView
              v-if="draft.displayIcon"
              :name="draft.displayIcon"
              :badge-size="48"
              :size="22"
            />
            <span
              v-else
              class="avatar-letter"
              :style="{ background: avatar.color }"
            >
              {{ avatar.text }}
            </span>
          </button>
          <div class="header-text">
            <h2 class="font-display header-title">
              {{ isCreating ? t('detail.newEntry') : draft.title || t('detail.untitled') }}
            </h2>
            <p class="url header-subtitle">
              {{ isCreating ? t('detail.fillAndSave') : draft.url || t('detail.noUrl') }}
            </p>
          </div>
        </div>
        <div class="header-actions">
          <button
            v-if="!props.detached && !isCreating && selectedEntry && !detachedDetailOpen"
            type="button"
            class="icon-btn"
            :title="t('detail.openInNewWindow')"
            :aria-label="t('detail.openInNewWindow')"
            @click="handleOpenDetached"
          >
            <SquareArrowOutUpRight
              :size="16"
              :stroke-width="1.5"
            />
          </button>
          <button
            v-if="!isCreating && selectedEntry"
            type="button"
            class="icon-btn favorite-btn"
            :class="{ active: selectedEntry.isFavorite }"
            :title="selectedEntry.isFavorite ? t('detail.removeFavorite') : t('detail.addFavorite')"
            @click="handleToggleFavorite"
          >
            <Star
              :size="16"
              :stroke-width="1.5"
              :fill="selectedEntry.isFavorite ? 'currentColor' : 'none'"
            />
          </button>
          <button
            v-if="!isCreating && selectedEntry"
            type="button"
            class="icon-btn danger"
            @click="handleDelete"
          >
            <Trash2
              :size="16"
              :stroke-width="1.5"
            />
          </button>
        </div>
      </div>

      <div
        ref="detailBodyRef"
        class="detail-body"
      >
        <div class="field">
          <label>{{ t('detail.title') }}</label>
          <UiInput
            v-model="draft.title"
            class="detail-field"
            :placeholder="t('detail.titlePlaceholder')"
            :readonly="!formEditable"
          />
        </div>

        <div class="field">
          <label>{{ t('detail.url') }}</label>
          <div class="field-row">
            <UiInput
              v-model="draft.url"
              class="detail-field"
              :placeholder="t('detail.urlPlaceholder')"
              :readonly="!formEditable"
            />
            <button
              type="button"
              class="icon-btn square"
              @click="handleCopyUrl"
            >
              <Copy
                :size="16"
                :stroke-width="1.5"
              />
            </button>
          </div>
        </div>

        <div class="field">
          <label>{{ t('detail.localProgramPath') }}</label>
          <UiInput
            v-model="draft.localProgramPath"
            class="detail-field"
            :placeholder="t('detail.localProgramPathPlaceholder')"
            :readonly="!formEditable"
          />
          <p
            v-if="formEditable"
            class="field-hint"
          >
            {{ t('detail.localProgramPathHint') }}
          </p>
        </div>

        <div class="field">
          <label>{{ t('detail.category') }}</label>
          <UiSelect
            :model-value="draft.categoryId ?? ''"
            class="detail-field"
            :options="categoryOptions"
            :disabled="!formEditable"
            @update:model-value="(v) => (draft.categoryId = v)"
          />
        </div>

        <div class="field">
          <label>{{ t('detail.username') }}</label>
          <div class="field-row">
            <UiInput
              v-model="draft.username"
              class="detail-field"
              :placeholder="t('detail.usernamePlaceholder')"
              :readonly="!formEditable"
            />
            <button
              type="button"
              class="icon-btn square"
              @click="handleCopyUsername"
            >
              <Copy
                :size="16"
                :stroke-width="1.5"
              />
            </button>
          </div>
        </div>

        <div class="field">
          <label>{{ t('detail.password') }}</label>
          <div class="field-row">
            <UiInput
              v-model="draft.password"
              :type="showPassword ? 'text' : 'password'"
              class="detail-field font-mono"
              :class="{ 'password-mask': !showPassword }"
              :readonly="!formEditable"
            />
            <button
              v-if="formEditable"
              type="button"
              class="icon-btn square"
              :title="t('detail.generatePassword')"
              :aria-label="t('detail.generatePassword')"
              @click="handleGeneratePassword"
            >
              <Sparkles
                :size="16"
                :stroke-width="1.5"
              />
            </button>
            <button
              type="button"
              class="icon-btn square"
              @click="showPassword = !showPassword"
            >
              <EyeOff
                v-if="showPassword"
                :size="16"
                :stroke-width="1.5"
              />
              <Eye
                v-else
                :size="16"
                :stroke-width="1.5"
              />
            </button>
            <button
              v-if="!isCreating && selectedEntry"
              type="button"
              class="icon-btn square"
              @click="handleCopyPassword"
            >
              <Copy
                :size="16"
                :stroke-width="1.5"
              />
            </button>
          </div>
          <div class="strength">
            <div class="bars">
              <span
                v-for="i in 4"
                :key="i"
                class="bar"
                :class="{ filled: i <= strengthLevel.bars }"
              />
            </div>
            <span class="strength-label">{{ strengthLevel.label }}</span>
          </div>
        </div>

        <div class="field">
          <label>{{ t('detail.totpSecret') }}</label>
          <div class="field-row">
            <UiInput
              v-model="draft.totpSecret"
              :type="showTotpSecret ? 'text' : 'password'"
              class="detail-field font-mono"
              :class="{ 'password-mask': !showTotpSecret }"
              :placeholder="t('detail.totpSecretPlaceholder')"
              :readonly="!formEditable"
            />
            <button
              type="button"
              class="icon-btn square"
              @click="showTotpSecret = !showTotpSecret"
            >
              <EyeOff
                v-if="showTotpSecret"
                :size="16"
                :stroke-width="1.5"
              />
              <Eye
                v-else
                :size="16"
                :stroke-width="1.5"
              />
            </button>
            <button
              v-if="hasValidTotp"
              type="button"
              class="icon-btn square"
              :title="t('detail.copyTotp')"
              @click="handleCopyTotp"
            >
              <Copy
                :size="16"
                :stroke-width="1.5"
              />
            </button>
          </div>
          <p class="field-hint">
            {{ t('detail.totpSecretHint') }}
          </p>
          <div
            v-if="hasValidTotp && totpCode"
            class="totp-live"
          >
            <Shield
              :size="14"
              :stroke-width="1.5"
            />
            <span class="totp-code font-mono">{{ totpCode }}</span>
            <button
              type="button"
              class="totp-copy-btn"
              :title="t('detail.copyTotp')"
              @click="handleCopyTotp"
            >
              <Copy
                :size="14"
                :stroke-width="1.5"
              />
            </button>
            <span class="totp-remaining">{{ t('detail.totpRemaining', { seconds: totpRemaining }) }}</span>
          </div>
        </div>

        <div
          v-if="!isCreating && selectedEntry"
          class="field"
        >
          <label>{{ t('detail.attachments') }}</label>
          <div
            v-if="attachmentsLoading"
            class="attachments-empty"
          >
            {{ t('common.processing') }}
          </div>
          <p
            v-else-if="attachments.length === 0"
            class="attachments-empty"
          >
            {{ t('detail.attachmentsEmpty') }}
          </p>
          <ul
            v-else
            class="attachment-list"
          >
            <li
              v-for="item in attachments"
              :key="item.id"
              class="attachment-item"
            >
              <FileText
                :size="16"
                :stroke-width="1.5"
                class="attachment-icon"
              />
              <div class="attachment-meta">
                <span class="attachment-name">{{ item.filename }}</span>
                <span class="attachment-size">{{ t('detail.attachmentSize', { size: formatFileSize(item.sizeBytes) }) }}</span>
              </div>
              <div class="attachment-actions">
                <button
                  type="button"
                  class="attachment-action-btn"
                  :title="t('detail.openAttachment')"
                  @click="handleOpenAttachment(item.id)"
                >
                  {{ t('detail.openAttachment') }}
                </button>
                <button
                  type="button"
                  class="attachment-action-btn"
                  :title="t('detail.saveAttachmentAs')"
                  @click="handleSaveAttachmentAs(item.id)"
                >
                  {{ t('detail.saveAttachmentAs') }}
                </button>
                <button
                  v-if="formEditable"
                  type="button"
                  class="attachment-delete-btn"
                  :title="t('detail.deleteAttachment')"
                  @click.stop="handleDeleteAttachment(item.id)"
                >
                  <Trash2
                    :size="14"
                    :stroke-width="1.5"
                  />
                </button>
              </div>
            </li>
          </ul>
          <UiButton
            v-if="formEditable"
            variant="ghost"
            class="attachment-add-btn"
            @click="handleAddAttachment"
          >
            <Paperclip
              :size="14"
              :stroke-width="1.5"
            />
            {{ t('detail.addAttachment') }}
          </UiButton>
        </div>

        <div class="field">
          <label>{{ t('detail.note') }}</label>
          <textarea
            v-model="draft.note"
            class="input-field note"
            rows="3"
            :placeholder="t('detail.notePlaceholder')"
            :readonly="!formEditable"
          />
        </div>

        <div class="field">
          <label>{{ t('detail.tags') }}</label>
          <div
            class="field-row tags-field-row"
            :class="{ 'tags-field-row--open': showTagPicker }"
          >
            <div
              class="tags-display input-field"
              role="group"
              :aria-label="t('detail.tags')"
            >
              <span
                v-if="draftTags.length === 0"
                class="tags-placeholder"
              >
                {{ formEditable ? t('detail.tagsPickHint') : t('detail.noTags') }}
              </span>
              <span
                v-for="(tag, index) in draftTags"
                :key="`${tag}-${index}`"
                class="selected-tag"
              >
                {{ tag }}
                <button
                  v-if="formEditable"
                  type="button"
                  class="selected-tag-remove"
                  :title="t('detail.removeTag', { name: tag })"
                  :aria-label="t('detail.removeTag', { name: tag })"
                  @click.stop="removeTag(index)"
                >
                  <X
                    :size="16"
                    :stroke-width="2"
                  />
                </button>
              </span>
            </div>
            <button
              v-if="formEditable"
              ref="tagPickerTriggerRef"
              type="button"
              class="icon-btn square tag-picker-trigger"
              :title="t('detail.pickExistingTags')"
              :aria-label="t('detail.pickExistingTags')"
              :aria-expanded="showTagPicker"
              @click.stop="toggleTagPicker"
            >
              <Tags
                :size="16"
                :stroke-width="1.5"
              />
            </button>
          </div>
        </div>

        <UiCheckbox
          v-model="draft.isFavorite"
          :label="t('detail.addFavorite')"
          class="favorite-row"
          :disabled="!formEditable"
        />
      </div>

      <div class="detail-footer">
        <template v-if="isCreating">
          <UiButton
            :variant="isAnimalIsland ? 'primary' : 'ghost'"
            class="vault-footer-btn"
            :class="{ 'footer-btn': !isAnimalIsland }"
            :block="isAnimalIsland"
            @click="cancelCreateEntry"
          >
            {{ t('common.cancel') }}
          </UiButton>
          <UiButton
            variant="primary"
            class="vault-footer-btn"
            :class="{ 'footer-btn save': !isAnimalIsland }"
            :block="isAnimalIsland"
            :disabled="loading"
            :loading="loading"
            @click="handleSave"
          >
            {{ loading ? t('common.saving') : t('common.save') }}
          </UiButton>
        </template>
        <template v-else-if="!isEditing">
          <UiButton
            variant="primary"
            class="vault-footer-btn"
            :class="{ 'footer-btn save': !isAnimalIsland }"
            :block="isAnimalIsland"
            @click="startEditing"
          >
            {{ t('detail.edit') }}
          </UiButton>
        </template>
        <template v-else>
          <UiButton
            :variant="isAnimalIsland ? 'primary' : 'ghost'"
            class="vault-footer-btn"
            :class="{ 'footer-btn': !isAnimalIsland }"
            :block="isAnimalIsland"
            @click="cancelEditing"
          >
            {{ t('common.cancel') }}
          </UiButton>
          <UiButton
            variant="primary"
            class="vault-footer-btn"
            :class="{ 'footer-btn save': !isAnimalIsland }"
            :block="isAnimalIsland"
            :disabled="loading"
            :loading="loading"
            @click="handleSave"
          >
            {{ loading ? t('common.saving') : t('common.save') }}
          </UiButton>
        </template>
      </div>
    </div>

    <IconPickerModal
      v-model:open="showIconPicker"
      :selected="draft.displayIcon"
      @select="handleIconSelect"
      @clear="handleIconClear"
    />

    <UiModal
      v-model:open="showAttachmentDeleteConfirm"
      :title="t('detail.deleteAttachment')"
      :width="400"
      :show-footer="false"
      @close="cancelAttachmentDeleteConfirm"
    >
      <p class="confirm-modal-body delete-confirm-text">
        {{ t('detail.deleteAttachmentConfirm', { filename: attachmentDeleteConfirm?.filename ?? '' }) }}
      </p>
      <template #footer>
        <div class="confirm-modal-actions">
          <UiButton
            variant="default"
            @click="cancelAttachmentDeleteConfirm"
          >
            {{ t('common.cancel') }}
          </UiButton>
          <UiButton
            variant="danger"
            @click="confirmDeleteAttachment"
          >
            {{ t('common.confirm') }}
          </UiButton>
        </div>
      </template>
    </UiModal>

    <Teleport to="body">
      <div
        v-if="showTagPicker"
        class="tag-picker-menu tag-picker-menu--portal surface-card"
        :style="tagPickerMenuStyle"
        @click.stop
      >
        <p
          v-if="availableVaultTags.length === 0"
          class="tag-picker-empty"
        >
          {{ t('detail.noTagsAvailable') }}
        </p>
        <button
          v-for="tag in availableVaultTags"
          :key="tag.name"
          type="button"
          class="tag-picker-item"
          @click="addTagFromVault(tag.name)"
        >
          <span class="tag-picker-label">{{ tag.name }}</span>
          <span class="tag-picker-count">{{ t('tag.entryCount', { count: tag.entryCount }) }}</span>
        </button>
      </div>
    </Teleport>
  </aside>
</template>

<style scoped>
.detail-shell.detached {
  flex: 1 1 auto;
  width: 100%;
  max-width: none;
  border-left: none;
  transition: none;
}

.detail-shell {
  position: relative;
  z-index: 2;
  flex-shrink: 0;
  align-self: stretch;
  height: 100%;
  display: flex;
  flex-direction: row;
  min-width: 0;
  background: var(--bg-surface);
  overflow: visible;
  transition: width 0.2s ease;
}

.detail-shell:not(.collapsed) {
  min-width: min(var(--detail-min-width), 100%);
}

.detail-shell.resizing {
  transition: none;
}

.detail-shell.collapsed {
  background: var(--bg-app);
}

.detail-main {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  padding: 24px 24px 24px 16px;
  border-bottom: 1px solid var(--border-default);
}

.header-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-text {
  flex: 1;
  min-width: 0;
}

.header-title {
  margin: 0;
  font-size: 18px;
  letter-spacing: -0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  flex-shrink: 0;
}

.avatar-btn {
  border: none;
  padding: 0;
  cursor: pointer;
  background: transparent;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.avatar-btn:hover {
  transform: scale(1.04);
}

.avatar-btn--readonly,
.avatar-btn:disabled {
  cursor: default;
  transform: none;
}

.avatar-btn--readonly:hover,
.avatar-btn:disabled:hover {
  transform: none;
}

.avatar-btn:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

.avatar-letter {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.icon-btn {
  padding: 8px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.icon-btn.favorite-btn.active {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.12);
}

.icon-btn.favorite-btn.active:hover {
  color: #d97706;
  background: rgba(245, 158, 11, 0.18);
}

.icon-btn.danger:hover {
  color: var(--status-danger);
}

.icon-btn.square {
  padding: 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
}

.icon-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.icon-btn:disabled:hover {
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.tags-field-row {
  position: relative;
  z-index: 1;
  align-items: stretch;
  min-width: 0;
}

.tags-field-row--open {
  z-index: 100;
}

.tags-field-row .tags-display.input-field {
  width: auto;
}

.tags-display {
  flex: 1 1 0;
  min-width: 0;
  width: auto;
  max-width: calc(100% - 48px);
  min-height: 44px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  cursor: default;
  pointer-events: none;
}

.tags-display .selected-tag,
.tags-display .tags-placeholder {
  pointer-events: auto;
}

.tags-placeholder {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.4;
}

.selected-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 5px 4px 5px 10px;
  border-radius: 6px;
  background: var(--accent-subtle);
  color: var(--accent-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.3;
}

.selected-tag-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  min-width: 28px;
  margin: -2px -2px -2px 0;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  opacity: 0.75;
  cursor: pointer;
  transition: opacity 0.15s, background-color 0.15s;
}

.selected-tag-remove:hover {
  opacity: 1;
  background: rgba(0, 0, 0, 0.08);
}

.tag-picker-trigger {
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  align-self: center;
  pointer-events: auto;
  cursor: pointer;
}

.tag-picker-menu--portal {
  min-width: 200px;
  overflow-y: auto;
  padding: 4px;
  pointer-events: auto;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.tag-picker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s;
}

.tag-picker-item:hover {
  background: var(--bg-hover);
}

.tag-picker-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-picker-count {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-muted);
}

.tag-picker-empty {
  margin: 0;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

.detail-body {
  position: relative;
  z-index: 1;
  padding: 24px 24px 24px 16px;
  min-height: 0;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  min-width: 0;
}

.field label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.field-hint {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--text-muted);
}

.totp-live {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-md, 8px);
  background: var(--accent-subtle);
  color: var(--accent-primary);
}

.totp-code {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.totp-copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--accent-primary);
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.totp-copy-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.totp-remaining {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
}

.attachments-empty {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.attachment-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-elevated);
  flex-wrap: wrap;
}

.attachment-icon {
  flex-shrink: 0;
  color: var(--text-muted);
}

.attachment-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.attachment-name {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attachment-size {
  font-size: 11px;
  color: var(--text-muted);
}

.attachment-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.attachment-action-btn {
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
}

.attachment-action-btn:hover {
  text-decoration: underline;
}

.attachment-delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
}

.attachment-delete-btn:hover {
  color: var(--danger, #dc2626);
}

.attachment-add-btn {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.field-row {
  display: flex;
  gap: 8px;
  min-width: 0;
}

.field-row .icon-btn.square {
  flex-shrink: 0;
}

.field-row :deep(.detail-field),
.field :deep(.detail-field) {
  min-width: 0;
  max-width: 100%;
}

.field :deep(.detail-field) {
  width: 100%;
}

.field-row :deep(.detail-field) {
  flex: 1 1 0;
  width: auto;
}

/* animal-island-vue Input: inline-flex + long text expands the whole panel */
.field-row :deep(.animal-input),
.field :deep(.animal-input) {
  display: flex;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.field-row :deep(.animal-input) {
  flex: 1 1 0;
  width: auto;
}

.field-row :deep(.animal-input__inner),
.field :deep(.animal-input__inner) {
  flex: 1 1 0;
  min-width: 0;
  width: 0;
}

.field :deep(.ui-animal-select) {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.field-row .input-field,
.field .input-field {
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

/* 经典 UiInput 的 input 在 wrap 内：flex 须加在 wrap 上，input 保持 width:100% */
.field-row>.input-field {
  flex: 1 1 0;
  width: auto;
}

.select {
  appearance: none;
}

.note {
  resize: vertical;
  min-height: 84px;
}

.favorite-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--text-secondary);
}

.strength {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.bars {
  flex: 1;
  display: flex;
  gap: 2px;
}

.bar {
  flex: 1;
  height: 4px;
  border-radius: 99px;
  background: var(--color-ink-600);
}

.bar.filled {
  background: var(--status-success);
}

.strength-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--status-success);
}

.detail-footer {
  position: relative;
  z-index: 0;
  display: flex;
  gap: 8px;
  min-width: 0;
  padding: 16px 16px 16px 12px;
  border-top: 1px solid var(--border-default);
}

.footer-btn {
  flex: 1;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
}

.save {
  font-weight: 600;
}

.save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.delete-confirm-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.confirm-modal-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.confirm-modal-actions :deep(.ui-classic-btn) {
  min-width: 96px;
  padding: 10px 22px;
}
</style>
