<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Settings, Lock, GripVertical, MailCheck, Sparkles, ChevronRight, ChevronDown, Search, Plus, Wrench } from 'lucide-vue-next'
import CategoryManagePanel from '@/components/CategoryManagePanel.vue'
import TagManagePanel from '@/components/TagManagePanel.vue'
import CategoryIconView from '@/components/CategoryIconView.vue'
import { Divider } from 'animal-island-vue'
import VaultClock from '@/components/VaultClock.vue'
import { UiInput } from '@/components/ui'
import { useTheme } from '@/composables/useTheme'
import { useAppState } from '@/composables/useAppState'
import type { FilterCategory } from '@/types'

const {
  categories,
  selectedCategory,
  selectCategory,
  navigateTo,
  openEmailBackup,
  openPasswordGen,
  lock,
  reorderSidebarCategories,
} = useAppState()

const { t } = useI18n()
const { isAnimalIsland } = useTheme()

const categorySearchQuery = ref('')
const categoryManagePanelRef = ref<InstanceType<typeof CategoryManagePanel> | null>(null)
const sidebarNavRef = ref<HTMLElement | null>(null)
const dragFromIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
const draggingId = ref<string | null>(null)
const dragMoved = ref(false)
const suppressNextClick = ref(false)
const activePointerId = ref<number | null>(null)

const BODY_DRAG_CLASS = 'category-drag-active'
const UTILITIES_EXPANDED_STORAGE_KEY = 'pwdbook-sidebar-utilities-expanded'

function readUtilitiesExpanded(): boolean {
  const stored = localStorage.getItem(UTILITIES_EXPANDED_STORAGE_KEY)
  return stored === null ? true : stored === 'true'
}

const utilitiesExpanded = ref(readUtilitiesExpanded())

const isDragging = computed(() => dragFromIndex.value !== null)

const isCategorySearchActive = computed(() => categorySearchQuery.value.trim().length > 0)

const displayCategories = computed(() => {
  const items = [...categories.value]
  const from = dragFromIndex.value
  const to = dragOverIndex.value
  if (from !== null && to !== null && from !== to) {
    const [moved] = items.splice(from, 1)
    items.splice(to, 0, moved)
  }

  const q = categorySearchQuery.value.trim().toLowerCase()
  if (!q) return items
  return items.filter((cat) => cat.label.toLowerCase().includes(q))
})

function cleanupDrag(): void {
  document.removeEventListener('pointermove', onDocumentPointerMove)
  document.removeEventListener('pointerup', onDocumentPointerUp)
  document.removeEventListener('pointercancel', onDocumentPointerUp)
  window.getSelection()?.removeAllRanges()
  document.body.classList.remove(BODY_DRAG_CLASS)
  document.body.style.userSelect = ''
  dragFromIndex.value = null
  dragOverIndex.value = null
  draggingId.value = null
  dragMoved.value = false
  activePointerId.value = null
}

function updateDragTarget(clientY: number): void {
  const nav = sidebarNavRef.value
  if (!nav || dragFromIndex.value === null) return

  const rows = nav.querySelectorAll<HTMLElement>('.sortable-row')
  if (!rows.length) return

  const navRect = nav.getBoundingClientRect()
  let targetIndex = rows.length - 1

  if (clientY <= navRect.top + 8) {
    targetIndex = 0
  } else if (clientY >= navRect.bottom - 8) {
    targetIndex = rows.length - 1
  } else {
    for (let i = 0; i < rows.length; i += 1) {
      const rect = rows[i].getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) {
        targetIndex = i
        break
      }
    }
  }

  if (dragOverIndex.value !== targetIndex) {
    dragOverIndex.value = targetIndex
  }
}

function onHandlePointerDown(categoryId: FilterCategory, event: PointerEvent): void {
  event.preventDefault()
  event.stopPropagation()
  window.getSelection()?.removeAllRanges()

  const index = categories.value.findIndex((category) => category.id === categoryId)
  if (index < 0) return

  const handle = event.currentTarget as HTMLElement
  handle.setPointerCapture(event.pointerId)
  activePointerId.value = event.pointerId

  dragFromIndex.value = index
  dragOverIndex.value = index
  draggingId.value = categoryId
  dragMoved.value = false
  document.body.classList.add(BODY_DRAG_CLASS)
  document.body.style.userSelect = 'none'

  document.addEventListener('pointermove', onDocumentPointerMove, { passive: false })
  document.addEventListener('pointerup', onDocumentPointerUp)
  document.addEventListener('pointercancel', onDocumentPointerUp)
}

function onDocumentPointerMove(event: PointerEvent): void {
  if (dragFromIndex.value === null) return
  if (activePointerId.value !== null && event.pointerId !== activePointerId.value) return

  event.preventDefault()
  dragMoved.value = true
  updateDragTarget(event.clientY)
}

async function onDocumentPointerUp(event: PointerEvent): Promise<void> {
  if (activePointerId.value !== null && event.pointerId !== activePointerId.value) return

  const fromIndex = dragFromIndex.value
  const toIndex = dragOverIndex.value
  const moved = dragMoved.value

  let newOrder: string[] | null = null
  if (moved && fromIndex !== null && toIndex !== null && fromIndex !== toIndex) {
    const reordered = [...categories.value]
    const [item] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, item)
    newOrder = reordered.map((category) => category.id)
  }

  suppressNextClick.value = Boolean(newOrder)
  cleanupDrag()

  if (newOrder) {
    await reorderSidebarCategories(newOrder)
  }
}

function onNavClick(categoryId: FilterCategory, event: MouseEvent): void {
  if (suppressNextClick.value) {
    suppressNextClick.value = false
    event.preventDefault()
    return
  }
  selectCategory(categoryId)
}

function openCreateCategory(): void {
  categoryManagePanelRef.value?.openCreateDialog()
}

function toggleUtilities(): void {
  utilitiesExpanded.value = !utilitiesExpanded.value
  localStorage.setItem(UTILITIES_EXPANDED_STORAGE_KEY, String(utilitiesExpanded.value))
}

onBeforeUnmount(() => {
  cleanupDrag()
})
</script>

<template>
  <aside
    class="sidebar"
    :class="{ 'is-sorting': isDragging, 'sidebar--animal': isAnimalIsland }"
  >
    <div class="sidebar-top">
      <VaultClock />
    </div>

    <div class="category-search-wrap">
      <div class="category-search-row">
        <div class="search-field-wrap">
          <Search v-if="!isAnimalIsland" class="search-field-icon" :size="14" :stroke-width="1.5" />
          <UiInput
            v-model="categorySearchQuery"
            class="search-field-input"
            :class="{ 'search-field-input--animal': isAnimalIsland }"
            :placeholder="t('vault.categorySearchPlaceholder')"
            allow-clear
          >
            <template v-if="isAnimalIsland" #prefix>
              <Search :size="14" :stroke-width="1.5" />
            </template>
          </UiInput>
        </div>
        <button
          type="button"
          class="category-add-btn"
          :title="t('category.newCategory')"
          :aria-label="t('category.newCategory')"
          @click="openCreateCategory"
        >
          <Plus :size="16" :stroke-width="1.5" />
        </button>
      </div>
    </div>

    <nav ref="sidebarNavRef" class="sidebar-nav">
      <TransitionGroup name="sort" tag="div" class="sort-list">
        <div
          v-for="cat in displayCategories"
          :key="cat.id"
          class="nav-item sortable sortable-row"
          :class="{
            active: selectedCategory === cat.id,
            'is-dragging': draggingId === cat.id,
            'no-drag': isCategorySearchActive,
          }"
          role="button"
          tabindex="0"
          @selectstart.prevent
          @click="onNavClick(cat.id as FilterCategory, $event)"
          @keydown.enter="selectCategory(cat.id as FilterCategory)"
        >
          <span
            v-if="!isCategorySearchActive"
            class="drag-handle"
            :title="t('vault.dragSort')"
            @pointerdown="onHandlePointerDown(cat.id, $event)"
          >
            <GripVertical :size="14" :stroke-width="1.5" />
          </span>
          <CategoryIconView :name="cat.icon" :badge-size="24" :size="14" />
          <span class="nav-label">{{ cat.label }}</span>
          <span class="count" :class="{ active: selectedCategory === cat.id }">{{ cat.count }}</span>
        </div>
      </TransitionGroup>
    </nav>

    <div class="sidebar-utilities">
      <button
        type="button"
        class="utilities-toggle"
        :aria-expanded="utilitiesExpanded"
        :title="utilitiesExpanded ? t('vault.collapseUtilities') : t('vault.expandUtilities')"
        @click="toggleUtilities"
      >
        <span class="utilities-toggle-leading">
          <span class="utilities-toggle-icon-wrap" aria-hidden="true">
            <Wrench class="utilities-toggle-icon" :size="15" :stroke-width="1.5" />
          </span>
          <span class="utilities-toggle-label">{{ t('tools.sectionLabel') }}</span>
        </span>
        <ChevronDown
          class="utilities-chevron"
          :class="{ open: utilitiesExpanded }"
          :size="14"
          :stroke-width="1.5"
        />
      </button>

      <div
        class="utilities-collapse"
        :class="{ 'utilities-collapse--open': utilitiesExpanded }"
      >
        <div class="utilities-body" :inert="!utilitiesExpanded || undefined">
          <Divider v-if="isAnimalIsland" type="wave-yellow" class="sidebar-divider" />

          <div class="tool-section">
            <div class="tool-list">
              <button type="button" class="tool-entry tool-entry--mail" @click="openEmailBackup">
                <span class="tool-entry-icon">
                  <MailCheck :size="16" :stroke-width="1.5" />
                </span>
                <span class="tool-entry-body">
                  <span class="tool-entry-title">{{ t('tools.emailBackupTitle') }}</span>
                  <span class="tool-entry-desc">{{ t('tools.emailBackupDesc') }}</span>
                </span>
                <ChevronRight class="tool-entry-arrow" :size="14" :stroke-width="1.5" />
              </button>
              <button type="button" class="tool-entry tool-entry--gen" @click="openPasswordGen()">
                <span class="tool-entry-icon">
                  <Sparkles :size="16" :stroke-width="1.5" />
                </span>
                <span class="tool-entry-body">
                  <span class="tool-entry-title">{{ t('tools.passwordGenTitle') }}</span>
                  <span class="tool-entry-desc">{{ t('tools.passwordGenDesc') }}</span>
                </span>
                <ChevronRight class="tool-entry-arrow" :size="14" :stroke-width="1.5" />
              </button>
            </div>
          </div>

          <div class="sidebar-bottom">
            <CategoryManagePanel ref="categoryManagePanelRef" />
            <TagManagePanel />
            <button type="button" class="nav-item" @click="navigateTo('settings')">
              <Settings :size="16" :stroke-width="1.5" />
              {{ t('vault.settings') }}
            </button>
            <button type="button" class="nav-item lock-btn" @click="lock">
              <Lock :size="16" :stroke-width="1.5" />
              {{ t('vault.lock') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border-right: 1px solid var(--border-default);
}

.sidebar.is-sorting {
  cursor: grabbing;
}

.sidebar.is-sorting .nav-item.sortable,
.sidebar.is-sorting .drag-handle {
  cursor: grabbing;
}

.sidebar.is-sorting .nav-item.sortable:not(.is-dragging) {
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.sidebar-divider {
  flex-shrink: 0;
}

.sidebar-top {
  padding: 10px 12px 4px;
}

.sidebar--animal .sidebar-top {
  padding: 10px 12px 8px;
}

.category-search-wrap {
  flex-shrink: 0;
  padding: 0 12px;
  margin-bottom: 8px;
}

.category-search-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.category-search-row .search-field-wrap {
  flex: 1;
  min-width: 0;
}

.category-add-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md, 8px);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background-color 0.15s;
}

.category-add-btn:hover {
  color: var(--accent-primary);
  border-color: var(--border-accent);
  background: var(--accent-subtle);
}

.category-add-btn:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

.sidebar-nav {
  flex: 1 1 auto;
  min-height: 0;
  padding: 0 12px;
  overflow-y: auto;
  user-select: none;
  -webkit-user-select: none;
}

.sidebar-top,
.sidebar-utilities,
.sidebar-divider {
  flex-shrink: 0;
}

.sidebar-utilities {
  border-top: 1px solid var(--border-default);
}

.utilities-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
}

.utilities-toggle:hover {
  color: var(--text-secondary);
  background: var(--bg-hover);
}

.utilities-toggle-label {
  margin: 0;
  padding: 0;
  line-height: 1.2;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.utilities-toggle-leading {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.utilities-toggle-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.utilities-toggle-icon {
  display: block;
  flex-shrink: 0;
  color: var(--text-muted);
  transition: color 0.15s;
}

.utilities-toggle:hover .utilities-toggle-label,
.utilities-toggle:hover .utilities-toggle-icon {
  color: var(--text-secondary);
}

.utilities-chevron {
  flex-shrink: 0;
  transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1);
}

.utilities-chevron.open {
  transform: rotate(180deg);
}

.utilities-collapse {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.32s cubic-bezier(0.4, 0, 0.2, 1);
}

.utilities-collapse--open {
  grid-template-rows: 1fr;
}

.utilities-body {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  opacity: 0;
  transition: opacity 0.22s ease;
}

.utilities-collapse--open .utilities-body {
  opacity: 1;
  transition: opacity 0.28s ease 0.06s;
}

.sidebar--animal .utilities-toggle {
  padding: 8px 12px 6px;
}

.sidebar--animal .tool-section {
  padding: 0 12px 6px;
}

.sidebar--animal .sidebar-divider {
  margin: 0 12px 6px;
}

.sort-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sort-move {
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.nav-item.sortable {
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  position: relative;
  will-change: transform;
}

.nav-item.is-dragging {
  z-index: 2;
  opacity: 0.96;
  transform: scale(1.015);
  background: var(--bg-elevated);
  box-shadow:
    0 10px 24px rgba(15, 23, 42, 0.12),
    0 0 0 1px var(--border-accent);
}

.nav-item.is-dragging.active {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  flex-shrink: 0;
  color: var(--text-muted);
  opacity: 0;
  transition: opacity 0.15s;
  cursor: grab;
  touch-action: none;
}

.nav-item.sortable:hover .drag-handle,
.sidebar.is-sorting .drag-handle {
  opacity: 1;
}

.nav-item.is-dragging .drag-handle {
  cursor: grabbing;
  color: var(--accent-primary);
}

.nav-item.no-drag {
  padding-left: 12px;
}

.nav-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  user-select: none;
  -webkit-user-select: none;
}

.count {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.count.active {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent-muted);
  color: var(--accent-primary);
}

.sidebar-bottom {
  margin-top: 4px;
  padding: 8px 12px 12px;
  border-top: 1px solid var(--border-default);
}

.tool-section {
  padding: 0 12px 8px;
}

.tool-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lock-btn:hover {
  color: var(--status-danger);
}
</style>
