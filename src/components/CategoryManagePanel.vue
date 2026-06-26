<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowLeft,
  FolderPlus,
  Layers,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'
import { useAppState } from '@/composables/useAppState'
import CategoryIconView from '@/components/CategoryIconView.vue'
import IconBadge from '@/components/IconBadge.vue'
import { NAV_ICON_STYLES } from '@/shared/navIconStyles'
import IconPickerModal from '@/components/IconPickerModal.vue'
import { UiInput, UiButton } from '@/components/ui'
import { textMatchesQuery } from '@/shared/searchMatch'

const props = withDefaults(
  defineProps<{
    showTrigger?: boolean
  }>(),
  {
    showTrigger: true,
  },
)

const { createCategory, updateCategory, deleteCategory, customCategories, loading, errorMessage, clearError } =
  useAppState()

const { t } = useI18n()
const { isAnimalIsland } = useTheme()

const showManageDialog = ref(false)
const manageSearchQuery = ref('')
const showCreateIconPicker = ref(false)
const showEditIconPicker = ref(false)
const editIconCategoryId = ref<string | null>(null)
const dialogMode = ref<'list' | 'create' | 'edit'>('list')
const confirmDeleteId = ref<string | null>(null)
const categoryName = ref('')
const localError = ref('')
const selectedIcon = ref('Folder')
const editingCategoryId = ref<string | null>(null)
const editingId = ref<string | null>(null)
const editingName = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

const categoryCount = computed(() => customCategories.value.length)

const filteredManageCategories = computed(() => {
  const q = manageSearchQuery.value.trim()
  if (!q) return customCategories.value
  return customCategories.value.filter((category) => textMatchesQuery(category.label, q))
})

const editIconPickerSelected = computed(() => {
  if (!editIconCategoryId.value) return 'Folder'
  return customCategories.value.find((category) => category.id === editIconCategoryId.value)?.icon ?? 'Folder'
})

function openManageDialog(): void {
  showManageDialog.value = true
  dialogMode.value = 'list'
  manageSearchQuery.value = ''
  confirmDeleteId.value = null
  localError.value = ''
  clearError()
}

function closeManageDialog(): void {
  showManageDialog.value = false
  dialogMode.value = 'list'
  manageSearchQuery.value = ''
  confirmDeleteId.value = null
  editingCategoryId.value = null
  editingId.value = null
  editingName.value = ''
  showEditIconPicker.value = false
  editIconCategoryId.value = null
  localError.value = ''
}

function openIconPicker(category: { id: string }): void {
  if (loading.value || confirmDeleteId.value) return
  editIconCategoryId.value = category.id
  showEditIconPicker.value = true
}

async function handleEditIconSelect(icon: string): Promise<void> {
  const categoryId = editIconCategoryId.value
  if (!categoryId) return

  const category = customCategories.value.find((item) => item.id === categoryId)
  if (!category || category.icon === icon) {
    showEditIconPicker.value = false
    editIconCategoryId.value = null
    return
  }

  localError.value = ''
  clearError()
  const ok = await updateCategory(categoryId, { name: category.label, icon })
  showEditIconPicker.value = false
  editIconCategoryId.value = null
  if (!ok) {
    localError.value = errorMessage.value
  }
}

function cancelEdit(): void {
  editingId.value = null
  editingName.value = ''
}

async function startEdit(category: { id: string; label: string }): Promise<void> {
  if (confirmDeleteId.value || loading.value) return
  confirmDeleteId.value = null
  localError.value = ''
  editingId.value = category.id
  editingName.value = category.label
  await nextTick()
  nameInputRef.value?.focus()
  nameInputRef.value?.select()
}

async function saveEdit(category: { id: string; label: string; icon: string }): Promise<void> {
  if (editingId.value !== category.id) return

  const name = editingName.value.trim()
  if (!name) {
    localError.value = t('errors.category_name_empty')
    return
  }
  if (name === category.label) {
    cancelEdit()
    return
  }

  localError.value = ''
  clearError()
  const ok = await updateCategory(category.id, { name, icon: category.icon })
  if (ok) {
    cancelEdit()
    return
  }
  localError.value = errorMessage.value
}

function openCreateView(): void {
  dialogMode.value = 'create'
  cancelEdit()
  categoryName.value = ''
  selectedIcon.value = 'Folder'
  localError.value = ''
  clearError()
}

function openCreateDialog(): void {
  showManageDialog.value = true
  openCreateView()
}

function openEditDialog(category: { id: string; label: string; icon: string }): void {
  showManageDialog.value = true
  dialogMode.value = 'edit'
  editingCategoryId.value = category.id
  categoryName.value = category.label
  selectedIcon.value = category.icon
  localError.value = ''
  clearError()
}

function backToList(): void {
  dialogMode.value = 'list'
  localError.value = ''
}

async function submitCategory(): Promise<void> {
  localError.value = ''
  const ok = await createCategory({
    name: categoryName.value,
    icon: selectedIcon.value,
  })
  if (ok) {
    closeManageDialog()
    return
  }
  localError.value = errorMessage.value
}

async function submitEditCategory(): Promise<void> {
  if (!editingCategoryId.value) return

  const name = categoryName.value.trim()
  if (!name) {
    localError.value = t('errors.category_name_empty')
    return
  }

  localError.value = ''
  clearError()
  const ok = await updateCategory(editingCategoryId.value, { name, icon: selectedIcon.value })
  if (ok) {
    closeManageDialog()
    return
  }
  localError.value = errorMessage.value
}

function startDelete(id: string): void {
  confirmDeleteId.value = id
  localError.value = ''
}

function cancelDelete(): void {
  confirmDeleteId.value = null
}

async function confirmDelete(id: string, name: string): Promise<void> {
  localError.value = ''
  const ok = await deleteCategory(id)
  confirmDeleteId.value = null
  if (!ok) {
    localError.value = errorMessage.value || t('errors.cannot_delete_category', { name })
  }
}

defineExpose({
  openManageDialog,
  openCreateDialog,
  openEditDialog,
})
</script>

<template>
  <button
    v-if="props.showTrigger"
    type="button"
    class="nav-item manage-trigger"
    @click="openManageDialog"
  >
    <IconBadge v-bind="NAV_ICON_STYLES.layers">
      <Layers
        :size="14"
        :stroke-width="1.5"
      />
    </IconBadge>
    {{ t('category.manage') }}
    <span
      v-if="categoryCount"
      class="trigger-count"
    >{{ categoryCount }}</span>
  </button>

  <Teleport to="body">
    <Transition name="dialog-fade">
      <div
        v-if="showManageDialog"
        class="dialog-overlay"
        @click.self="closeManageDialog"
      >
        <div class="dialog surface-card">
          <template v-if="dialogMode === 'list'">
            <div class="dialog-header">
              <div>
                <h4 class="dialog-title">
                  {{ t('category.manage') }}
                </h4>
                <p class="dialog-desc">
                  {{ t('category.manageDesc', { count: categoryCount }) }}
                </p>
              </div>
              <button
                type="button"
                class="icon-btn"
                :aria-label="t('common.close')"
                @click="closeManageDialog"
              >
                <X
                  :size="16"
                  :stroke-width="1.5"
                />
              </button>
            </div>

            <div class="dialog-toolbar">
              <button
                type="button"
                class="create-btn"
                @click="openCreateView"
              >
                <Plus
                  :size="14"
                  :stroke-width="1.5"
                />
                {{ t('category.newCategory') }}
              </button>
            </div>

            <div
              v-if="customCategories.length"
              class="search-field-wrap manage-search-wrap"
            >
              <Search
                v-if="!isAnimalIsland"
                class="search-field-icon"
                :size="14"
                :stroke-width="1.5"
              />
              <UiInput
                v-model="manageSearchQuery"
                class="search-field-input"
                :class="{ 'search-field-input--animal': isAnimalIsland }"
                :placeholder="t('category.searchPlaceholder')"
                allow-clear
              >
                <template
                  v-if="isAnimalIsland"
                  #prefix
                >
                  <Search
                    :size="14"
                    :stroke-width="1.5"
                  />
                </template>
              </UiInput>
            </div>

            <p
              v-if="localError"
              class="error-text"
            >
              {{ localError }}
            </p>

            <div
              v-if="customCategories.length && filteredManageCategories.length"
              class="manage-list"
            >
              <div
                v-for="category in filteredManageCategories"
                :key="category.id"
                class="manage-item"
                :class="{ confirming: confirmDeleteId === category.id }"
              >
                <template v-if="confirmDeleteId === category.id">
                  <span class="confirm-text">{{ t('category.deleteConfirm', { name: category.label }) }}</span>
                  <div class="confirm-actions">
                    <button
                      type="button"
                      class="ghost-btn"
                      @click="cancelDelete"
                    >
                      {{ t('common.cancel') }}
                    </button>
                    <button
                      type="button"
                      class="danger-btn"
                      :disabled="loading"
                      @click="confirmDelete(category.id, category.label)"
                    >
                      {{ t('common.delete') }}
                    </button>
                  </div>
                </template>

                <template v-else>
                  <button
                    type="button"
                    class="category-icon-btn"
                    :title="t('category.editIcon')"
                    :aria-label="t('category.editIcon')"
                    @click.stop="openIconPicker(category)"
                  >
                    <CategoryIconView
                      :name="category.icon"
                      :badge-size="28"
                      :size="15"
                    />
                  </button>
                  <UiInput
                    v-if="editingId === category.id"
                    ref="nameInputRef"
                    v-model="editingName"
                    class="name-input"
                    :maxlength="20"
                    :disabled="loading"
                    @keydown.enter="saveEdit(category)"
                    @keydown.escape="cancelEdit"
                    @blur="saveEdit(category)"
                  />
                  <button
                    v-else
                    type="button"
                    class="manage-name"
                    :title="t('category.editName')"
                    @click="startEdit(category)"
                  >
                    {{ category.label }}
                  </button>
                  <span class="entry-count">{{ t('category.entryCount', { count: category.count }) }}</span>
                  <button
                    type="button"
                    class="delete-btn"
                    :class="{ disabled: category.count > 0 }"
                    :title="
                      category.count > 0
                        ? t('category.hasEntriesHint', { count: category.count })
                        : t('category.deleteCategory')
                    "
                    :disabled="category.count > 0"
                    :aria-label="t('category.deleteCategory')"
                    @click="startDelete(category.id)"
                  >
                    <Trash2
                      :size="14"
                      :stroke-width="1.5"
                    />
                  </button>
                </template>
              </div>
            </div>

            <div
              v-else-if="customCategories.length && !filteredManageCategories.length"
              class="empty-state"
            >
              <Search
                :size="22"
                :stroke-width="1.5"
              />
              <p>{{ t('category.noSearchResults') }}</p>
            </div>

            <div
              v-else
              class="empty-state"
            >
              <FolderPlus
                :size="22"
                :stroke-width="1.5"
              />
              <p>{{ t('category.empty') }}</p>
              <button
                type="button"
                class="empty-action"
                @click="openCreateView"
              >
                {{ t('category.createFirst') }}
              </button>
            </div>
          </template>

          <template v-else-if="dialogMode === 'create'">
            <div class="dialog-header">
              <button
                type="button"
                class="icon-btn back-btn"
                :aria-label="t('common.back')"
                @click="backToList"
              >
                <ArrowLeft
                  :size="16"
                  :stroke-width="1.5"
                />
              </button>
              <div class="header-main">
                <h4 class="dialog-title">
                  {{ t('category.newCategory') }}
                </h4>
                <p class="dialog-desc">
                  {{ t('category.createHint') }}
                </p>
              </div>
              <button
                type="button"
                class="icon-btn"
                :aria-label="t('common.close')"
                @click="closeManageDialog"
              >
                <X
                  :size="16"
                  :stroke-width="1.5"
                />
              </button>
            </div>

            <label class="field-label">{{ t('category.categoryName') }}</label>
            <UiInput
              v-model="categoryName"
              :maxlength="20"
              :placeholder="t('category.namePlaceholder')"
              @keydown.enter="submitCategory"
            />

            <label class="field-label">{{ t('category.icon') }}</label>
            <button
              type="button"
              class="icon-picker-trigger"
              @click="showCreateIconPicker = true"
            >
              <CategoryIconView
                :name="selectedIcon"
                :badge-size="36"
                :size="18"
              />
              <span>{{ t('category.pickIcon') }}</span>
            </button>

            <p
              v-if="localError"
              class="error-text"
            >
              {{ localError }}
            </p>

            <div class="dialog-actions">
              <UiButton
                variant="ghost"
                class="action-btn"
                @click="backToList"
              >
                {{ t('common.cancel') }}
              </UiButton>
              <UiButton
                variant="primary"
                class="action-btn"
                :disabled="loading || !categoryName.trim()"
                :loading="loading"
                @click="submitCategory"
              >
                {{ loading ? t('common.creating') : t('category.createCategory') }}
              </UiButton>
            </div>
          </template>

          <template v-else>
            <div class="dialog-header">
              <div class="header-main">
                <h4 class="dialog-title">
                  {{ t('category.editCategory') }}
                </h4>
                <p class="dialog-desc">
                  {{ t('category.editHint') }}
                </p>
              </div>
              <button
                type="button"
                class="icon-btn"
                :aria-label="t('common.close')"
                @click="closeManageDialog"
              >
                <X
                  :size="16"
                  :stroke-width="1.5"
                />
              </button>
            </div>

            <label class="field-label">{{ t('category.categoryName') }}</label>
            <UiInput
              v-model="categoryName"
              :maxlength="20"
              :placeholder="t('category.namePlaceholder')"
              @keydown.enter="submitEditCategory"
            />

            <label class="field-label">{{ t('category.icon') }}</label>
            <button
              type="button"
              class="icon-picker-trigger"
              @click="showCreateIconPicker = true"
            >
              <CategoryIconView
                :name="selectedIcon"
                :badge-size="36"
                :size="18"
              />
              <span>{{ t('category.pickIcon') }}</span>
            </button>

            <p
              v-if="localError"
              class="error-text"
            >
              {{ localError }}
            </p>

            <div class="dialog-actions">
              <UiButton
                variant="ghost"
                class="action-btn"
                @click="closeManageDialog"
              >
                {{ t('common.cancel') }}
              </UiButton>
              <UiButton
                variant="primary"
                class="action-btn"
                :disabled="loading || !categoryName.trim()"
                :loading="loading"
                @click="submitEditCategory"
              >
                {{ loading ? t('common.saving') : t('common.save') }}
              </UiButton>
            </div>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>

  <IconPickerModal
    v-model:open="showCreateIconPicker"
    :selected="selectedIcon"
    :allow-clear="false"
    :title="t('category.pickIcon')"
    @select="selectedIcon = $event"
  />
  <IconPickerModal
    v-model:open="showEditIconPicker"
    :selected="editIconPickerSelected"
    :allow-clear="false"
    :title="t('category.pickIcon')"
    @select="handleEditIconSelect"
  />
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

.category-icon-btn {
  flex-shrink: 0;
  border: none;
  padding: 0;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.category-icon-btn:hover {
  transform: scale(1.06);
}

.category-icon-btn:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
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
  padding: 4px 8px;
  font-size: 14px;
}

.entry-count {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-muted);
}

.delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 6px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s, background-color 0.15s, color 0.15s;
}

.manage-item:hover .delete-btn,
.delete-btn:focus-visible {
  opacity: 1;
}

.delete-btn:hover:not(.disabled) {
  color: var(--status-danger);
  background: rgba(239, 68, 68, 0.08);
}

.delete-btn.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.manage-item:hover .delete-btn.disabled {
  opacity: 0.35;
}

.confirm-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--status-danger);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.confirm-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.ghost-btn,
.danger-btn {
  border: none;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
}

.ghost-btn {
  background: transparent;
  color: var(--text-secondary);
}

.ghost-btn:hover {
  background: var(--bg-hover);
}

.danger-btn {
  background: var(--status-danger);
  color: #fff;
}

.danger-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 12px;
  color: var(--text-muted);
  text-align: center;
}

.empty-state p {
  margin: 0;
  font-size: 13px;
}

.empty-action {
  margin-top: 4px;
  border: none;
  background: transparent;
  color: var(--accent-primary);
  font-size: 13px;
  cursor: pointer;
}

.error-text {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--status-danger);
}

.field-label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin: 12px 0 6px;
}

.field-label:first-of-type {
  margin-top: 0;
}

.icon-picker-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--border-default);
  border-radius: 10px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.icon-picker-trigger:hover {
  border-color: var(--border-accent);
  background: var(--bg-hover);
}

.dialog-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.action-btn {
  flex: 1;
  padding: 10px 12px;
  font-size: 13px;
}

.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.18s ease;
}

.dialog-fade-enter-active .dialog,
.dialog-fade-leave-active .dialog {
  transition: transform 0.18s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-from .dialog,
.dialog-fade-leave-to .dialog {
  transform: scale(0.98) translateY(4px);
}
</style>
