<script setup lang="ts">
import { ref } from 'vue'
import { FolderPlus, Trash2, X } from 'lucide-vue-next'
import { useAppState } from '@/composables/useAppState'
import { CATEGORY_ICON_OPTIONS, getCategoryIcon } from '@/shared/categoryIcons'

const props = defineProps<{
  collapsed?: boolean
}>()

const { createCategory, deleteCategory, customCategories, loading, errorMessage, clearError } =
  useAppState()

const showForm = ref(false)
const categoryName = ref('')
const localError = ref('')
const selectedIcon = ref('Folder')

function openForm(): void {
  showForm.value = true
  categoryName.value = ''
  selectedIcon.value = 'Folder'
  localError.value = ''
  clearError()
}

function closeForm(): void {
  showForm.value = false
  localError.value = ''
}

async function submitCategory(): Promise<void> {
  localError.value = ''
  const ok = await createCategory({
    name: categoryName.value,
    icon: selectedIcon.value,
  })
  if (ok) {
    closeForm()
    return
  }
  localError.value = errorMessage.value
}

async function handleDelete(id: string, name: string): Promise<void> {
  if (!window.confirm(`确定删除分类「${name}」吗？`)) return
  localError.value = ''
  const ok = await deleteCategory(id)
  if (!ok) {
    localError.value = errorMessage.value
  }
}
</script>

<template>
  <div class="category-manage" :class="{ collapsed: props.collapsed }">
    <button
      type="button"
      class="add-category-btn"
      :title="props.collapsed ? '添加分类' : undefined"
      @click="openForm"
    >
      <FolderPlus :size="16" :stroke-width="1.5" />
      <span v-if="!props.collapsed">添加分类</span>
    </button>

    <div v-if="showForm && !props.collapsed" class="category-form surface-card">
      <div class="form-header">
        <span class="form-title">新建分类</span>
        <button type="button" class="close-btn" @click="closeForm">
          <X :size="14" :stroke-width="1.5" />
        </button>
      </div>

      <label class="field-label">分类名称</label>
      <input
        v-model="categoryName"
        class="input-field"
        maxlength="20"
        placeholder="例如：学习、购物"
        @keydown.enter="submitCategory"
      />

      <label class="field-label">图标</label>
      <div class="icon-grid">
        <button
          v-for="icon in CATEGORY_ICON_OPTIONS"
          :key="icon.value"
          type="button"
          class="icon-option"
          :class="{ selected: selectedIcon === icon.value }"
          :title="icon.label"
          @click="selectedIcon = icon.value"
        >
          <component :is="getCategoryIcon(icon.value)" :size="18" :stroke-width="1.5" />
        </button>
      </div>

      <p v-if="localError" class="error-text">{{ localError }}</p>

      <button type="button" class="btn-primary submit-btn" :disabled="loading" @click="submitCategory">
        {{ loading ? '创建中…' : '创建分类' }}
      </button>
    </div>

    <Teleport to="body">
      <div v-if="showForm && props.collapsed" class="form-overlay" @click.self="closeForm">
        <div class="category-form surface-card form-dialog">
          <div class="form-header">
            <span class="form-title">新建分类</span>
            <button type="button" class="close-btn" @click="closeForm">
              <X :size="14" :stroke-width="1.5" />
            </button>
          </div>

          <label class="field-label">分类名称</label>
          <input
            v-model="categoryName"
            class="input-field"
            maxlength="20"
            placeholder="例如：学习、购物"
            @keydown.enter="submitCategory"
          />

          <label class="field-label">图标</label>
          <div class="icon-grid">
            <button
              v-for="icon in CATEGORY_ICON_OPTIONS"
              :key="icon.value"
              type="button"
              class="icon-option"
              :class="{ selected: selectedIcon === icon.value }"
              :title="icon.label"
              @click="selectedIcon = icon.value"
            >
              <component :is="getCategoryIcon(icon.value)" :size="18" :stroke-width="1.5" />
            </button>
          </div>

          <p v-if="localError" class="error-text">{{ localError }}</p>

          <button type="button" class="btn-primary submit-btn" :disabled="loading" @click="submitCategory">
            {{ loading ? '创建中…' : '创建分类' }}
          </button>
        </div>
      </div>
    </Teleport>

    <p v-if="localError && !showForm && !props.collapsed" class="error-text">{{ localError }}</p>

    <div v-if="customCategories.length && !props.collapsed" class="manage-list">
      <div v-for="category in customCategories" :key="category.id" class="manage-item">
        <component :is="getCategoryIcon(category.icon)" :size="14" :stroke-width="1.5" class="item-icon" />
        <span class="manage-name">{{ category.label }}</span>
        <button
          type="button"
          class="delete-btn"
          title="删除分类"
          aria-label="删除分类"
          @click="handleDelete(category.id, category.label)"
        >
          <Trash2 :size="14" :stroke-width="1.5" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.category-manage {
  padding: 8px 12px 12px;
  border-top: 1px solid var(--border-default);
}

.category-manage.collapsed {
  padding: 0;
  border-top: none;
}

.add-category-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.category-manage.collapsed .add-category-btn {
  padding: 10px;
  border-radius: 8px;
}

.add-category-btn:hover {
  color: var(--accent-primary);
  border-color: var(--border-accent);
  background: var(--accent-subtle);
}

.category-form {
  margin-top: 12px;
  padding: 14px;
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.form-title {
  font-size: 13px;
  font-weight: 600;
}

.close-btn {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}

.field-label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin: 10px 0 6px;
}

.field-label:first-of-type {
  margin-top: 0;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.icon-option {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.icon-option:hover {
  border-color: var(--border-accent);
  color: var(--accent-primary);
}

.icon-option.selected {
  border-color: var(--accent-primary);
  background: var(--accent-subtle);
  color: var(--accent-primary);
}

.submit-btn {
  width: 100%;
  margin-top: 14px;
  padding: 10px;
  font-size: 13px;
}

.error-text {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--status-danger);
}

.manage-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.manage-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--bg-elevated);
}

.item-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.manage-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--status-danger);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  flex-shrink: 0;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}

.form-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
}

.form-dialog {
  width: min(320px, calc(100vw - 48px));
  margin: 0;
}
</style>
