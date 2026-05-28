<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ArrowLeft,
  FolderPlus,
  Layers,
  Plus,
  Trash2,
  X,
} from 'lucide-vue-next'
import { useAppState } from '@/composables/useAppState'
import CategoryIconView from '@/components/CategoryIconView.vue'
import IconPickerModal from '@/components/IconPickerModal.vue'

const { createCategory, deleteCategory, customCategories, loading, errorMessage, clearError } =
  useAppState()

const showManageDialog = ref(false)
const showCreateIconPicker = ref(false)
const dialogMode = ref<'list' | 'create'>('list')
const confirmDeleteId = ref<string | null>(null)
const categoryName = ref('')
const localError = ref('')
const selectedIcon = ref('Folder')

const categoryCount = computed(() => customCategories.value.length)

function openManageDialog(): void {
  showManageDialog.value = true
  dialogMode.value = 'list'
  confirmDeleteId.value = null
  localError.value = ''
  clearError()
}

function closeManageDialog(): void {
  showManageDialog.value = false
  dialogMode.value = 'list'
  confirmDeleteId.value = null
  localError.value = ''
}

function openCreateView(): void {
  dialogMode.value = 'create'
  categoryName.value = ''
  selectedIcon.value = 'Folder'
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
    dialogMode.value = 'list'
    categoryName.value = ''
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
    localError.value = errorMessage.value || `无法删除「${name}」`
  }
}
</script>

<template>
  <button type="button" class="nav-item manage-trigger" @click="openManageDialog">
    <Layers :size="16" :stroke-width="1.5" />
    分类管理
    <span v-if="categoryCount" class="trigger-count">{{ categoryCount }}</span>
  </button>

  <Teleport to="body">
    <Transition name="dialog-fade">
      <div v-if="showManageDialog" class="dialog-overlay" @click.self="closeManageDialog">
        <div class="dialog surface-card">
          <template v-if="dialogMode === 'list'">
            <div class="dialog-header">
              <div>
                <h4 class="dialog-title">分类管理</h4>
                <p class="dialog-desc">共 {{ categoryCount }} 个分类 · 排序请在侧边栏拖拽</p>
              </div>
              <button type="button" class="icon-btn" aria-label="关闭" @click="closeManageDialog">
                <X :size="16" :stroke-width="1.5" />
              </button>
            </div>

            <div class="dialog-toolbar">
              <button type="button" class="create-btn" @click="openCreateView">
                <Plus :size="14" :stroke-width="1.5" />
                新建分类
              </button>
            </div>

            <p v-if="localError" class="error-text">{{ localError }}</p>

            <div v-if="customCategories.length" class="manage-list">
              <div
                v-for="category in customCategories"
                :key="category.id"
                class="manage-item"
                :class="{ confirming: confirmDeleteId === category.id }"
              >
                <template v-if="confirmDeleteId === category.id">
                  <span class="confirm-text">删除「{{ category.label }}」？</span>
                  <div class="confirm-actions">
                    <button type="button" class="ghost-btn" @click="cancelDelete">取消</button>
                    <button
                      type="button"
                      class="danger-btn"
                      :disabled="loading"
                      @click="confirmDelete(category.id, category.label)"
                    >
                      删除
                    </button>
                  </div>
                </template>

                <template v-else>
                  <CategoryIconView :name="category.icon" :badge-size="28" :size="15" />
                  <span class="manage-name" :title="category.label">{{ category.label }}</span>
                  <span class="entry-count">{{ category.count }} 条</span>
                  <button
                    type="button"
                    class="delete-btn"
                    :class="{ disabled: category.count > 0 }"
                    :title="
                      category.count > 0
                        ? `该分类下有 ${category.count} 条密码，无法删除`
                        : '删除分类'
                    "
                    :disabled="category.count > 0"
                    aria-label="删除分类"
                    @click="startDelete(category.id)"
                  >
                    <Trash2 :size="14" :stroke-width="1.5" />
                  </button>
                </template>
              </div>
            </div>

            <div v-else class="empty-state">
              <FolderPlus :size="22" :stroke-width="1.5" />
              <p>还没有自定义分类</p>
              <button type="button" class="empty-action" @click="openCreateView">创建第一个</button>
            </div>
          </template>

          <template v-else>
            <div class="dialog-header">
              <button type="button" class="icon-btn back-btn" aria-label="返回" @click="backToList">
                <ArrowLeft :size="16" :stroke-width="1.5" />
              </button>
              <div class="header-main">
                <h4 class="dialog-title">新建分类</h4>
                <p class="dialog-desc">创建后可在侧边栏拖拽调整顺序</p>
              </div>
              <button type="button" class="icon-btn" aria-label="关闭" @click="closeManageDialog">
                <X :size="16" :stroke-width="1.5" />
              </button>
            </div>

            <label class="field-label">分类名称</label>
            <input
              v-model="categoryName"
              class="input-field"
              maxlength="20"
              placeholder="例如：学习、购物"
              autofocus
              @keydown.enter="submitCategory"
            />

            <label class="field-label">图标</label>
            <button type="button" class="icon-picker-trigger" @click="showCreateIconPicker = true">
              <CategoryIconView :name="selectedIcon" :badge-size="36" :size="18" />
              <span>选择图标</span>
            </button>

            <p v-if="localError" class="error-text">{{ localError }}</p>

            <div class="dialog-actions">
              <button type="button" class="btn-ghost action-btn" @click="backToList">取消</button>
              <button
                type="button"
                class="btn-primary action-btn"
                :disabled="loading || !categoryName.trim()"
                @click="submitCategory"
              >
                {{ loading ? '创建中…' : '创建分类' }}
              </button>
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
    title="选择图标"
    @select="selectedIcon = $event"
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
  z-index: 9998;
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

.item-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.item-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.manage-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
