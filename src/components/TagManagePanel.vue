<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Hash, Plus, Search, Trash2, X } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'
import { useAppState } from '@/composables/useAppState'
import { UiInput, UiButton } from '@/components/ui'

const { vaultTags, createTag, updateTag, deleteTag, loading, errorMessage, clearError } = useAppState()

const { t } = useI18n()
const { isAnimalIsland } = useTheme()

const showManageDialog = ref(false)
const manageSearchQuery = ref('')
const dialogMode = ref<'list' | 'create'>('list')
const confirmDeleteName = ref<string | null>(null)
const tagName = ref('')
const localError = ref('')
const editingName = ref<string | null>(null)
const editingValue = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

const tagCount = computed(() => vaultTags.value.length)

const filteredTags = computed(() => {
  const q = manageSearchQuery.value.trim().toLowerCase()
  if (!q) return vaultTags.value
  return vaultTags.value.filter((tag) => tag.name.toLowerCase().includes(q))
})

function openManageDialog(): void {
  showManageDialog.value = true
  dialogMode.value = 'list'
  manageSearchQuery.value = ''
  confirmDeleteName.value = null
  localError.value = ''
  clearError()
}

function closeManageDialog(): void {
  showManageDialog.value = false
  dialogMode.value = 'list'
  manageSearchQuery.value = ''
  confirmDeleteName.value = null
  editingName.value = null
  editingValue.value = ''
  localError.value = ''
}

function openCreateView(): void {
  dialogMode.value = 'create'
  cancelEdit()
  tagName.value = ''
  localError.value = ''
  clearError()
}

function backToList(): void {
  dialogMode.value = 'list'
  localError.value = ''
}

function cancelEdit(): void {
  editingName.value = null
  editingValue.value = ''
}

async function startEdit(tag: { name: string }): Promise<void> {
  if (confirmDeleteName.value || loading.value) return
  confirmDeleteName.value = null
  localError.value = ''
  editingName.value = tag.name
  editingValue.value = tag.name
  await nextTick()
  nameInputRef.value?.focus()
  nameInputRef.value?.select()
}

async function saveEdit(tag: { name: string }): Promise<void> {
  if (editingName.value !== tag.name) return

  const name = editingValue.value.trim()
  if (!name) {
    localError.value = t('errors.tag_name_empty')
    return
  }
  if (name === tag.name) {
    cancelEdit()
    return
  }

  localError.value = ''
  clearError()
  const ok = await updateTag(tag.name, { name })
  if (ok) {
    cancelEdit()
    return
  }
  localError.value = errorMessage.value
}

async function submitTag(): Promise<void> {
  localError.value = ''
  const ok = await createTag({ name: tagName.value })
  if (ok) {
    dialogMode.value = 'list'
    tagName.value = ''
    return
  }
  localError.value = errorMessage.value
}

function startDelete(name: string): void {
  confirmDeleteName.value = name
  localError.value = ''
}

function cancelDelete(): void {
  confirmDeleteName.value = null
}

async function confirmDelete(tag: { name: string; entryCount: number }): Promise<void> {
  localError.value = ''
  const ok = await deleteTag(tag.name)
  confirmDeleteName.value = null
  if (!ok) {
    localError.value = errorMessage.value
  }
}
</script>

<template>
  <button type="button" class="nav-item manage-trigger" @click="openManageDialog">
    <Hash :size="16" :stroke-width="1.5" />
    {{ t('tag.manage') }}
    <span v-if="tagCount" class="trigger-count">{{ tagCount }}</span>
  </button>

  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="showManageDialog" class="dialog-overlay" @click.self="closeManageDialog">
        <div class="dialog surface-card">
          <template v-if="dialogMode === 'list'">
            <div class="dialog-header">
              <div>
                <h4 class="dialog-title">{{ t('tag.manage') }}</h4>
                <p class="dialog-desc">{{ t('tag.manageDesc', { count: tagCount }) }}</p>
              </div>
              <button type="button" class="icon-btn" :aria-label="t('common.close')" @click="closeManageDialog">
                <X :size="16" :stroke-width="1.5" />
              </button>
            </div>

            <div class="dialog-toolbar">
              <button type="button" class="create-btn" @click="openCreateView">
                <Plus :size="14" :stroke-width="1.5" />
                {{ t('tag.newTag') }}
              </button>
            </div>

            <div v-if="vaultTags.length" class="search-field-wrap manage-search-wrap">
              <Search v-if="!isAnimalIsland" class="search-field-icon" :size="14" :stroke-width="1.5" />
              <UiInput
                v-model="manageSearchQuery"
                class="search-field-input"
                :class="{ 'search-field-input--animal': isAnimalIsland }"
                :placeholder="t('tag.searchPlaceholder')"
                allow-clear
              >
                <template v-if="isAnimalIsland" #prefix>
                  <Search :size="14" :stroke-width="1.5" />
                </template>
              </UiInput>
            </div>

            <p v-if="localError" class="error-text">{{ localError }}</p>

            <div v-if="vaultTags.length && filteredTags.length" class="manage-list">
              <div
                v-for="tag in filteredTags"
                :key="tag.name"
                class="manage-item"
                :class="{ confirming: confirmDeleteName === tag.name }"
              >
                <template v-if="confirmDeleteName === tag.name">
                  <span class="confirm-text">
                    {{
                      tag.entryCount > 0
                        ? t('tag.deleteConfirmWithEntries', { name: tag.name, count: tag.entryCount })
                        : t('tag.deleteConfirm', { name: tag.name })
                    }}
                  </span>
                  <div class="confirm-actions">
                    <button type="button" class="ghost-btn" @click="cancelDelete">{{ t('common.cancel') }}</button>
                    <button
                      type="button"
                      class="danger-btn"
                      :disabled="loading"
                      @click="confirmDelete(tag)"
                    >
                      {{ t('common.delete') }}
                    </button>
                  </div>
                </template>

                <template v-else>
                  <UiInput
                    v-if="editingName === tag.name"
                    ref="nameInputRef"
                    v-model="editingValue"
                    class="name-input"
                    :maxlength="30"
                    :disabled="loading"
                    @keydown.enter="saveEdit(tag)"
                    @keydown.escape="cancelEdit"
                    @blur="saveEdit(tag)"
                  />
                  <button
                    v-else
                    type="button"
                    class="manage-name"
                    :title="t('tag.editName')"
                    @click="startEdit(tag)"
                  >
                    {{ tag.name }}
                  </button>
                  <span class="entry-count">{{ t('tag.entryCount', { count: tag.entryCount }) }}</span>
                  <button
                    type="button"
                    class="delete-btn"
                    :title="t('tag.deleteTag')"
                    :aria-label="t('tag.deleteTag')"
                    @click="startDelete(tag.name)"
                  >
                    <Trash2 :size="14" :stroke-width="1.5" />
                  </button>
                </template>
              </div>
            </div>

            <div v-else-if="vaultTags.length && !filteredTags.length" class="empty-state">
              <Search :size="22" :stroke-width="1.5" />
              <p>{{ t('tag.noSearchResults') }}</p>
            </div>

            <div v-else class="empty-state">
              <Hash :size="22" :stroke-width="1.5" />
              <p>{{ t('tag.empty') }}</p>
              <button type="button" class="empty-action" @click="openCreateView">{{ t('tag.createFirst') }}</button>
            </div>
          </template>

          <template v-else>
            <div class="dialog-header">
              <button type="button" class="icon-btn back-btn" :aria-label="t('common.back')" @click="backToList">
                <ArrowLeft :size="16" :stroke-width="1.5" />
              </button>
              <div class="header-main">
                <h4 class="dialog-title">{{ t('tag.newTag') }}</h4>
                <p class="dialog-desc">{{ t('tag.createHint') }}</p>
              </div>
              <button type="button" class="icon-btn" :aria-label="t('common.close')" @click="closeManageDialog">
                <X :size="16" :stroke-width="1.5" />
              </button>
            </div>

            <label class="field-label">{{ t('tag.tagName') }}</label>
            <UiInput
              v-model="tagName"
              :maxlength="30"
              :placeholder="t('tag.namePlaceholder')"
              @keydown.enter="submitTag"
            />

            <p v-if="localError" class="error-text">{{ localError }}</p>

            <div class="dialog-actions">
              <UiButton variant="ghost" class="action-btn" @click="backToList">{{ t('common.cancel') }}</UiButton>
              <UiButton
                variant="primary"
                class="action-btn"
                :disabled="loading || !tagName.trim()"
                :loading="loading"
                @click="submitTag"
              >
                {{ loading ? t('common.creating') : t('tag.createTag') }}
              </UiButton>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.manage-trigger {
  position: relative;
}

.trigger-count {
  margin-left: auto;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay-app);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}

.dialog {
  width: min(420px, calc(100vw - 48px));
  max-height: min(520px, calc(100vh - 48px));
  padding: 20px;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  flex-shrink: 0;
}

.header-main {
  flex: 1;
  min-width: 0;
}

.dialog-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.dialog-desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

.icon-btn {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  flex-shrink: 0;
}

.icon-btn:hover {
  background: var(--bg-hover);
}

.back-btn {
  margin-right: 4px;
}

.dialog-toolbar {
  margin-bottom: 12px;
  flex-shrink: 0;
}

.manage-search-wrap {
  margin-bottom: 12px;
  flex-shrink: 0;
}

.create-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.create-btn:hover {
  color: var(--accent-primary);
  border-color: var(--border-accent);
  background: var(--accent-subtle);
}

.manage-list {
  flex: 1;
  min-height: 0;
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0 -4px;
  padding: 0 4px;
}

.manage-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 8px 10px;
  border-radius: 8px;
  transition: background-color 0.15s;
}

.manage-item:hover {
  background: var(--bg-hover);
}

.manage-item.confirming {
  background: rgba(239, 68, 68, 0.06);
}

.manage-name {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
  margin: -4px -6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font-size: 14px;
  color: var(--text-primary);
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
  transition: background-color 0.15s;
}

.manage-name:hover {
  background: var(--bg-elevated);
}

.name-input {
  flex: 1;
  min-width: 0;
}

.entry-count {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.delete-btn {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--text-muted);
  padding: 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
}

.delete-btn:hover {
  color: var(--status-danger);
  background: rgba(239, 68, 68, 0.08);
}

.confirm-text {
  flex: 1;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.confirm-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.ghost-btn,
.danger-btn {
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--border-default);
}

.ghost-btn {
  background: transparent;
  color: var(--text-secondary);
}

.danger-btn {
  background: var(--status-danger);
  border-color: var(--status-danger);
  color: #fff;
}

.danger-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  color: var(--text-muted);
  text-align: center;
}

.empty-state p {
  margin: 0;
  font-size: 13px;
}

.empty-action {
  margin-top: 4px;
  padding: 8px 14px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--bg-elevated);
  color: var(--accent-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.field-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.error-text {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--status-danger);
}

.dialog-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.action-btn {
  flex: 1;
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
</style>
