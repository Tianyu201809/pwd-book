<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Star, Trash2, Copy, Eye, EyeOff, ChevronRight, ChevronLeft, Sparkles } from 'lucide-vue-next'
import CategoryIconView from '@/components/CategoryIconView.vue'
import IconPickerModal from '@/components/IconPickerModal.vue'
import { useAppState } from '@/composables/useAppState'
import { getAvatarMeta } from '@/shared/utils'
import type { PasswordEntryInput } from '@/types'

const COLLAPSED_STORAGE_KEY = 'pwdbook-detail-collapsed'
const WIDTH_STORAGE_KEY = 'pwdbook-detail-width'
const DETAIL_MIN_WIDTH = 280
const DETAIL_MAX_WIDTH = 560
const DETAIL_DEFAULT_WIDTH = 360
const DETAIL_COLLAPSED_WIDTH = 40

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
  openPasswordGen,
  pendingApplyPassword,
  consumePendingApplyPassword,
} = useAppState()

const { t } = useI18n()

function loadPanelWidth(): number {
  const stored = Number(localStorage.getItem(WIDTH_STORAGE_KEY))
  if (!Number.isFinite(stored)) return DETAIL_DEFAULT_WIDTH
  return Math.min(DETAIL_MAX_WIDTH, Math.max(DETAIL_MIN_WIDTH, stored))
}

const collapsed = ref(localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true')
const panelWidth = ref(loadPanelWidth())
const isResizing = ref(false)
const showPassword = ref(false)
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
})

const categoryOptions = computed(() =>
  vaultCategories.value.map((category) => ({
    value: category.id,
    label: category.name,
  })),
)

const tagsInput = ref('')

const avatar = computed(() => getAvatarMeta(draft.value.title || t('detail.newEntry')))

const strengthLevel = computed(() => {
  const len = draft.value.password.length
  if (len >= 16) return { label: t('detail.strengthStrong'), bars: 3 }
  if (len >= 10) return { label: t('detail.strengthMedium'), bars: 2 }
  if (len >= 1) return { label: t('detail.strengthWeak'), bars: 1 }
  return { label: t('detail.strengthNone'), bars: 0 }
})

const shellWidth = computed(() =>
  collapsed.value ? `${DETAIL_COLLAPSED_WIDTH}px` : `${panelWidth.value}px`,
)

function resetDraftFromEntry(): void {
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
    }
    tagsInput.value = ''
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
  }
  tagsInput.value = selectedEntry.value.tags.join(', ')
}

watch([selectedEntry, isCreating], resetDraftFromEntry, { immediate: true })

watch(pendingApplyPassword, (password) => {
  if (password) {
    draft.value.password = password
    consumePendingApplyPassword()
  }
}, { immediate: true })

function buildInput(): PasswordEntryInput {
  return {
    ...draft.value,
    tags: tagsInput.value
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
  }
}

async function handleSave(): Promise<void> {
  const id = isCreating.value ? null : selectedEntry.value?.id ?? null
  await saveEntry(id, buildInput())
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

function handleIconSelect(icon: string): void {
  draft.value.displayIcon = icon
}

function handleIconClear(): void {
  draft.value.displayIcon = ''
}

function toggleCollapse(): void {
  collapsed.value = !collapsed.value
  localStorage.setItem(COLLAPSED_STORAGE_KEY, String(collapsed.value))
}

function stopResize(): void {
  isResizing.value = false
  localStorage.setItem(WIDTH_STORAGE_KEY, String(panelWidth.value))
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', stopResize)
}

function onResizeMove(event: MouseEvent): void {
  const shell = document.querySelector('.detail-shell') as HTMLElement | null
  if (!shell) return
  const rect = shell.getBoundingClientRect()
  const next = Math.round(rect.right - event.clientX)
  panelWidth.value = Math.min(DETAIL_MAX_WIDTH, Math.max(DETAIL_MIN_WIDTH, next))
}

function onResizeStart(event: MouseEvent): void {
  if (collapsed.value || event.button !== 0) return
  isResizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', stopResize)
}

onUnmounted(() => {
  stopResize()
})

const showPanel = computed(() => isCreating.value || Boolean(selectedEntry.value))

watch(isCreating, (creating) => {
  if (creating) {
    collapsed.value = false
    localStorage.setItem(COLLAPSED_STORAGE_KEY, 'false')
  }
})
</script>

<template>
  <aside
    v-if="showPanel"
    class="detail-shell"
    :class="{ collapsed, resizing: isResizing }"
    :style="{ width: shellWidth }"
  >
    <div
      class="panel-edge"
      :class="{ collapsed }"
      @mousedown="onResizeStart"
    >
      <button
        type="button"
        class="edge-toggle"
        :title="collapsed ? t('detail.expand') : t('detail.collapse')"
        :aria-label="collapsed ? t('detail.expand') : t('detail.collapse')"
        @mousedown.stop
        @click.stop="toggleCollapse"
      >
        <ChevronRight v-if="!collapsed" :size="16" :stroke-width="2" />
        <ChevronLeft v-else :size="16" :stroke-width="2" />
      </button>
    </div>

    <div v-if="!collapsed" class="detail-main">
      <div class="detail-header">
        <div class="header-main">
          <button
            type="button"
            class="avatar avatar-btn"
            :title="t('detail.pickIcon')"
            :aria-label="t('detail.pickIcon')"
            @click="showIconPicker = true"
          >
            <CategoryIconView
              v-if="draft.displayIcon"
              :name="draft.displayIcon"
              :badge-size="48"
              :size="22"
            />
            <span v-else class="avatar-letter" :style="{ background: avatar.color }">
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
            <Trash2 :size="16" :stroke-width="1.5" />
          </button>
        </div>
      </div>

      <div class="detail-body">
        <div class="field">
          <label>{{ t('detail.title') }}</label>
          <input v-model="draft.title" class="input-field" :placeholder="t('detail.titlePlaceholder')" />
        </div>

        <div class="field">
          <label>{{ t('detail.url') }}</label>
          <div class="field-row">
            <input v-model="draft.url" class="input-field" :placeholder="t('detail.urlPlaceholder')" />
            <button type="button" class="icon-btn square" @click="handleCopyUrl">
              <Copy :size="16" :stroke-width="1.5" />
            </button>
          </div>
        </div>

        <div class="field">
          <label>{{ t('detail.category') }}</label>
          <select v-model="draft.categoryId" class="input-field select">
            <option v-for="option in categoryOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="field">
          <label>{{ t('detail.username') }}</label>
          <div class="field-row">
            <input v-model="draft.username" class="input-field" :placeholder="t('detail.usernamePlaceholder')" />
            <button type="button" class="icon-btn square" @click="handleCopyUsername">
              <Copy :size="16" :stroke-width="1.5" />
            </button>
          </div>
        </div>

        <div class="field">
          <label>{{ t('detail.password') }}</label>
          <div class="field-row">
            <input
              v-model="draft.password"
              :type="showPassword ? 'text' : 'password'"
              class="input-field font-mono"
              :class="{ 'password-mask': !showPassword }"
            />
            <button type="button" class="icon-btn square" @click="showPassword = !showPassword">
              <EyeOff v-if="showPassword" :size="16" :stroke-width="1.5" />
              <Eye v-else :size="16" :stroke-width="1.5" />
            </button>
            <button
              v-if="!isCreating && selectedEntry"
              type="button"
              class="icon-btn square"
              @click="handleCopyPassword"
            >
              <Copy :size="16" :stroke-width="1.5" />
            </button>
          </div>
          <div class="strength">
            <div class="bars">
              <span v-for="i in 4" :key="i" class="bar" :class="{ filled: i <= strengthLevel.bars }" />
            </div>
            <span class="strength-label">{{ strengthLevel.label }}</span>
          </div>
        </div>

        <div class="field">
          <label>{{ t('detail.note') }}</label>
          <textarea v-model="draft.note" class="input-field note" rows="3" :placeholder="t('detail.notePlaceholder')" />
        </div>

        <div class="field">
          <label>{{ t('detail.tags') }}</label>
          <input v-model="tagsInput" class="input-field" :placeholder="t('detail.tagsPlaceholder')" />
        </div>

        <label class="favorite-row">
          <input v-model="draft.isFavorite" type="checkbox" />
          <span>{{ t('detail.addFavorite') }}</span>
        </label>
      </div>

      <div class="detail-footer">
        <button
          v-if="isCreating"
          type="button"
          class="btn-ghost footer-btn"
          @click="cancelCreateEntry"
        >
          {{ t('common.cancel') }}
        </button>
        <button type="button" class="btn-ghost footer-btn gen-btn" @click="openPasswordGen(true)">
          <Sparkles :size="14" :stroke-width="1.5" />
          {{ t('detail.generatePassword') }}
        </button>
        <button type="button" class="btn-primary footer-btn save" :disabled="loading" @click="handleSave">
          {{ loading ? t('common.saving') : t('common.save') }}
        </button>
      </div>
    </div>

    <IconPickerModal
      v-model:open="showIconPicker"
      :selected="draft.displayIcon"
      @select="handleIconSelect"
      @clear="handleIconClear"
    />
  </aside>
</template>

<style scoped>
.detail-shell {
  flex-shrink: 0;
  align-self: stretch;
  height: 100%;
  display: flex;
  flex-direction: row;
  min-width: 0;
  background: var(--bg-surface);
  border-left: 1px solid var(--border-default);
  overflow: hidden;
  transition: width 0.2s ease;
}

.detail-shell.resizing {
  transition: none;
}

.panel-edge {
  position: relative;
  flex-shrink: 0;
  align-self: stretch;
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid var(--border-default);
  background: var(--bg-app);
  cursor: col-resize;
  touch-action: none;
}

.panel-edge.collapsed {
  width: 100%;
  border-right: none;
  cursor: default;
}

.edge-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--border-default);
  border-radius: 6px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}

.edge-toggle:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--accent-primary);
}

.detail-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
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

.detail-body {
  padding: 24px 24px 24px 16px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
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

.field-row {
  display: flex;
  gap: 8px;
}

.field-row .input-field,
.field .input-field {
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
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
  display: flex;
  gap: 8px;
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
</style>
