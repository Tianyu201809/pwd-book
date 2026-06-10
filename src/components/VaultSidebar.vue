<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Settings, Lock, GripVertical, Sparkles, ChevronDown, Search, Plus, Wrench, Pencil, Trash2, ArchiveRestore, ShieldAlert, Hash } from 'lucide-vue-next'
import PanelEdge from '@/components/PanelEdge.vue'
import CategoryManagePanel from '@/components/CategoryManagePanel.vue'
import TagManagePanel from '@/components/TagManagePanel.vue'
import TagFilterPanel from '@/components/TagFilterPanel.vue'
import CategoryIconView from '@/components/CategoryIconView.vue'
import IconBadge from '@/components/IconBadge.vue'
import { NAV_ICON_STYLES } from '@/shared/navIconStyles'
import VaultClock from '@/components/VaultClock.vue'
import { UiInput } from '@/components/ui'
import { useTheme } from '@/composables/useTheme'
import { useAppState } from '@/composables/useAppState'
import { showToast } from '@/composables/useToast'
import { textMatchesQuery } from '@/shared/searchMatch'
import { parseErrorMessage } from '@/shared/utils'
import type { FilterCategory } from '@/types'

const WIDTH_STORAGE_KEY = 'pwdbook-sidebar-width'
const COLLAPSED_STORAGE_KEY = 'pwdbook-sidebar-collapsed'
const PANEL_EDGE_WIDTH = 4
const SIDEBAR_CONTENT_WIDTH_FALLBACK = 240
const SIDEBAR_COLLAPSED_WIDTH = 40
const SIDEBAR_MIN_WIDTH_FALLBACK = 180
const SIDEBAR_MAX_WIDTH_FALLBACK = 360
const LIST_COLUMN_MIN_WIDTH_FALLBACK = 240

function readCssPxVar(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readSidebarContentDefaultWidth(): number {
  return readCssPxVar('--sidebar-width', SIDEBAR_CONTENT_WIDTH_FALLBACK)
}

function readSidebarDefaultShellWidth(): number {
  return readSidebarContentDefaultWidth() + PANEL_EDGE_WIDTH
}

function readSidebarMinWidth(): number {
  return readCssPxVar('--sidebar-min-width', SIDEBAR_MIN_WIDTH_FALLBACK) + PANEL_EDGE_WIDTH
}

function readSidebarMaxWidth(): number {
  return readCssPxVar('--sidebar-max-width', SIDEBAR_MAX_WIDTH_FALLBACK) + PANEL_EDGE_WIDTH
}

function readListColumnMinWidth(): number {
  return readCssPxVar('--list-column-min-width', LIST_COLUMN_MIN_WIDTH_FALLBACK)
}

function readSidebarCollapsed(): boolean {
  return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true'
}

function loadSidebarWidth(): number {
  const stored = Number(localStorage.getItem(WIDTH_STORAGE_KEY))
  const defaultShell = readSidebarDefaultShellWidth()
  let base = Number.isFinite(stored) ? stored : defaultShell
  // 兼容旧版：总宽 240 实为未计入拖拽条的内容宽度
  if (base === readSidebarContentDefaultWidth()) {
    base = defaultShell
  }
  const minW = readSidebarMinWidth()
  const maxW = readSidebarMaxWidth()
  return Math.min(maxW, Math.max(minW, base))
}

function getMaxSidebarWidth(): number {
  const body = document.querySelector('.vault-body')
  if (!body) return readSidebarMaxWidth()
  const detail = document.querySelector('.detail-shell')
  const detailWidth = detail?.getBoundingClientRect().width ?? 0
  const reserved = readListColumnMinWidth() + detailWidth
  const available = body.getBoundingClientRect().width - reserved
  return Math.min(readSidebarMaxWidth(), Math.max(0, Math.floor(available)))
}

function clampSidebarWidth(): void {
  if (sidebarCollapsed.value) return
  const minW = readSidebarMinWidth()
  const max = getMaxSidebarWidth()
  if (max < minW) {
    setSidebarCollapsed(true)
    return
  }
  panelWidth.value = Math.min(max, Math.max(minW, panelWidth.value))
}

function setSidebarCollapsed(collapsed: boolean): void {
  sidebarCollapsed.value = collapsed
  localStorage.setItem(COLLAPSED_STORAGE_KEY, String(collapsed))
}

type SidebarCategoryItem = {
  id: string
  label: string
  icon: string
  count: number
}

const {
  categories,
  vaultTags,
  selectedCategory,
  selectedTagFilters,
  selectCategory,
  navigateTo,
  openPasswordGen,
  openPasswordHealth,
  openTrash,
  vaultStatus,
  lock,
  reorderSidebarCategories,
  deleteCategory,
  loading,
  errorMessage,
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
const contextMenu = ref<{ category: SidebarCategoryItem; x: number; y: number; confirmDelete: boolean } | null>(null)
const contextMenuRef = ref<HTMLElement | null>(null)

const BODY_DRAG_CLASS = 'category-drag-active'
const VIEWPORT_MENU_PADDING = 8
const UTILITIES_EXPANDED_STORAGE_KEY = 'pwdbook-sidebar-utilities-expanded'
const TAG_FILTER_EXPANDED_STORAGE_KEY = 'pwdbook-sidebar-tag-filter-expanded'

const sidebarCollapsed = ref(readSidebarCollapsed())
const panelWidth = ref(loadSidebarWidth())
const isResizing = ref(false)

const shellWidth = computed(() =>
  sidebarCollapsed.value ? `${SIDEBAR_COLLAPSED_WIDTH}px` : `${panelWidth.value}px`,
)

const shellStyle = computed(() => ({
  width: shellWidth.value,
  maxWidth: shellWidth.value,
  flexBasis: shellWidth.value,
}))

function toggleSidebarCollapse(): void {
  setSidebarCollapsed(!sidebarCollapsed.value)
}

function stopResize(): void {
  isResizing.value = false
  localStorage.setItem(WIDTH_STORAGE_KEY, String(panelWidth.value))
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', stopResize)
  window.dispatchEvent(new Event('resize'))
}

function onResizeMove(event: MouseEvent): void {
  const shell = document.querySelector('.sidebar-shell') as HTMLElement | null
  if (!shell) return
  const rect = shell.getBoundingClientRect()
  const next = Math.round(event.clientX - rect.left)
  const minW = readSidebarMinWidth()
  const max = getMaxSidebarWidth()
  if (max < minW) return
  panelWidth.value = Math.min(max, Math.max(minW, next))
  window.dispatchEvent(new Event('resize'))
}

function onResizeStart(event: MouseEvent): void {
  if (sidebarCollapsed.value || event.button !== 0) return
  isResizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', stopResize)
}

function onVaultLayoutResize(): void {
  clampSidebarWidth()
}

function isCustomCategory(id: string): boolean {
  return id !== 'all' && id !== 'favorite'
}

function closeContextMenu(): void {
  contextMenu.value = null
}

function adjustContextMenuPosition(): void {
  const menu = contextMenuRef.value
  if (!menu || !contextMenu.value) return

  const { width, height } = menu.getBoundingClientRect()
  const maxX = window.innerWidth - width - VIEWPORT_MENU_PADDING
  const maxY = window.innerHeight - height - VIEWPORT_MENU_PADDING

  contextMenu.value = {
    ...contextMenu.value,
    x: Math.max(VIEWPORT_MENU_PADDING, Math.min(contextMenu.value.x, maxX)),
    y: Math.max(VIEWPORT_MENU_PADDING, Math.min(contextMenu.value.y, maxY)),
  }
}

function handleCategoryContextMenu(category: SidebarCategoryItem, event: MouseEvent): void {
  if (!isCustomCategory(category.id)) return
  event.preventDefault()
  event.stopPropagation()
  contextMenu.value = {
    category,
    x: event.clientX,
    y: event.clientY,
    confirmDelete: false,
  }
  nextTick(adjustContextMenuPosition)
}

function handleEditCategory(): void {
  const category = contextMenu.value?.category
  closeContextMenu()
  if (category) {
    categoryManagePanelRef.value?.openEditDialog(category)
  }
}

function startContextDelete(): void {
  if (!contextMenu.value || contextMenu.value.category.count > 0) return
  contextMenu.value = { ...contextMenu.value, confirmDelete: true }
  nextTick(adjustContextMenuPosition)
}

function cancelContextDelete(): void {
  if (!contextMenu.value) return
  contextMenu.value = { ...contextMenu.value, confirmDelete: false }
}

async function confirmContextDelete(): Promise<void> {
  const category = contextMenu.value?.category
  if (!category || category.count > 0) return

  closeContextMenu()
  const ok = await deleteCategory(category.id)
  if (!ok) {
    showToast(errorMessage.value || t('errors.cannot_delete_category', { name: category.label }), 'error')
  }
}

function onDocumentClick(): void {
  closeContextMenu()
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeContextMenu()
}

function readUtilitiesExpanded(): boolean {
  const stored = localStorage.getItem(UTILITIES_EXPANDED_STORAGE_KEY)
  return stored === null ? false : stored === 'true'
}

function readTagFilterExpanded(): boolean {
  const stored = localStorage.getItem(TAG_FILTER_EXPANDED_STORAGE_KEY)
  return stored === null ? false : stored === 'true'
}

const utilitiesExpanded = ref(readUtilitiesExpanded())
const tagFilterExpanded = ref(readTagFilterExpanded())

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

  const q = categorySearchQuery.value.trim()
  if (!q) return items
  return items.filter((cat) => textMatchesQuery(cat.label, q))
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

function toggleTagFilter(): void {
  tagFilterExpanded.value = !tagFilterExpanded.value
  localStorage.setItem(TAG_FILTER_EXPANDED_STORAGE_KEY, String(tagFilterExpanded.value))
}

watch(sidebarCollapsed, () => {
  nextTick(() => {
    clampSidebarWidth()
    window.dispatchEvent(new Event('resize'))
  })
})

onMounted(() => {
  clampSidebarWidth()
  window.addEventListener('resize', onVaultLayoutResize)
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
})

onBeforeUnmount(() => {
  cleanupDrag()
  stopResize()
  window.removeEventListener('resize', onVaultLayoutResize)
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <aside
    class="sidebar sidebar-shell"
    :class="{
      collapsed: sidebarCollapsed,
      resizing: isResizing,
      'is-sorting': isDragging,
      'sidebar--animal': isAnimalIsland,
    }"
    :style="shellStyle"
  >
    <div v-if="!sidebarCollapsed" class="sidebar-main">
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
          @contextmenu="handleCategoryContextMenu(cat, $event)"
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

    <div v-if="vaultTags.length" class="sidebar-tags">
      <button
        type="button"
        class="utilities-toggle tag-filter-toggle"
        :aria-expanded="tagFilterExpanded"
        :title="tagFilterExpanded ? t('vault.collapseTagFilter') : t('vault.expandTagFilter')"
        @click="toggleTagFilter"
      >
        <span class="utilities-toggle-leading">
          <span class="utilities-toggle-icon-wrap" aria-hidden="true">
            <Hash class="utilities-toggle-icon" :size="15" :stroke-width="1.5" />
          </span>
          <span class="utilities-toggle-label">
            {{ t('vault.tagFilterTitle') }}
            <span v-if="selectedTagFilters.length" class="tag-filter-active-badge">
              {{ selectedTagFilters.length }}
            </span>
          </span>
        </span>
        <ChevronDown
          class="utilities-chevron"
          :class="{ open: tagFilterExpanded }"
          :size="14"
          :stroke-width="1.5"
        />
      </button>

      <div
        class="utilities-collapse"
        :class="{ 'utilities-collapse--open': tagFilterExpanded }"
      >
        <div class="utilities-body tag-filter-body" :inert="!tagFilterExpanded || undefined">
          <TagFilterPanel />
        </div>
      </div>
    </div>

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

          <div class="sidebar-bottom">
            <button
              type="button"
              class="nav-item"
              :title="t('tools.passwordGenDesc')"
              @click="openPasswordGen()"
            >
              <IconBadge v-bind="NAV_ICON_STYLES.passwordGen">
                <Sparkles :size="14" :stroke-width="1.5" />
              </IconBadge>
              {{ t('tools.passwordGenTitle') }}
            </button>
            <button
              type="button"
              class="nav-item"
              :title="t('tools.passwordHealth.desc')"
              @click="openPasswordHealth()"
            >
              <IconBadge v-bind="NAV_ICON_STYLES.shield">
                <ShieldAlert :size="14" :stroke-width="1.5" />
              </IconBadge>
              {{ t('tools.passwordHealth.title') }}
            </button>
            <CategoryManagePanel ref="categoryManagePanelRef" />
            <TagManagePanel />
            <button type="button" class="nav-item" @click="openTrash">
              <IconBadge v-bind="NAV_ICON_STYLES.trash">
                <ArchiveRestore :size="14" :stroke-width="1.5" />
              </IconBadge>
              {{ t('vault.trash') }}
              <span v-if="vaultStatus.trashCount > 0" class="nav-badge">{{ vaultStatus.trashCount }}</span>
            </button>
            <button type="button" class="nav-item" @click="navigateTo('settings')">
              <IconBadge v-bind="NAV_ICON_STYLES.settings">
                <Settings :size="14" :stroke-width="1.5" />
              </IconBadge>
              {{ t('vault.settings') }}
            </button>
            <button type="button" class="nav-item lock-btn" @click="lock">
              <IconBadge v-bind="NAV_ICON_STYLES.lock">
                <Lock :size="14" :stroke-width="1.5" />
              </IconBadge>
              {{ t('vault.lock') }}
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>

    <PanelEdge
      placement="after"
      :collapsed="sidebarCollapsed"
      :resizing="isResizing"
      :expand-label="t('vault.expandSidebar')"
      :collapse-label="t('vault.collapseSidebar')"
      @toggle="toggleSidebarCollapse"
      @resize-start="onResizeStart"
    />
  </aside>

  <Teleport to="body">
    <div
      v-if="contextMenu"
      ref="contextMenuRef"
      class="category-context-menu menu-popover surface-card"
      :style="{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }"
      @click.stop
    >
      <template v-if="!contextMenu.confirmDelete">
        <button type="button" class="context-menu-item" @click="handleEditCategory">
          <Pencil :size="14" :stroke-width="1.5" />
          {{ t('common.edit') }}
        </button>
        <button
          type="button"
          class="context-menu-item context-menu-item--danger"
          :class="{ 'context-menu-item--disabled': contextMenu.category.count > 0 }"
          :disabled="contextMenu.category.count > 0"
          :title="
            contextMenu.category.count > 0
              ? t('category.hasEntriesHint', { count: contextMenu.category.count })
              : t('category.deleteCategory')
          "
          @click="startContextDelete"
        >
          <Trash2 :size="14" :stroke-width="1.5" />
          {{ t('common.delete') }}
        </button>
      </template>
      <template v-else>
        <p class="context-menu-confirm">{{ t('category.deleteConfirm', { name: contextMenu.category.label }) }}</p>
        <div class="context-menu-confirm-actions">
          <button type="button" class="context-menu-item" @click="cancelContextDelete">
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="context-menu-item context-menu-item--danger"
            :disabled="loading"
            @click="confirmContextDelete"
          >
            {{ t('common.delete') }}
          </button>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.sidebar-shell {
  position: relative;
  z-index: 2;
  flex-shrink: 0;
  align-self: stretch;
  height: 100%;
  display: flex;
  flex-direction: row;
  min-width: 0;
  overflow: visible;
  transition: width 0.2s ease;
  background: var(--bg-surface);
}

.sidebar-shell:not(.collapsed) {
  min-width: min(calc(var(--sidebar-min-width) + var(--panel-edge-width, 4px)), 100%);
}

.sidebar-shell.resizing {
  transition: none;
}

.sidebar-shell.collapsed {
  background: var(--bg-app);
}

.sidebar-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
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
.sidebar-utilities {
  flex-shrink: 0;
}

.sidebar-tags {
  flex-shrink: 0;
  position: relative;
  z-index: 2;
  border-top: 1px solid var(--border-default);
}

.tag-filter-body {
  padding: 0 12px;
  overflow: hidden;
}

.utilities-collapse--open .tag-filter-body {
  padding-bottom: 10px;
  overflow: visible;
}

.tag-filter-active-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  margin-left: 6px;
  padding: 0 4px;
  border-radius: 99px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0;
  text-transform: none;
  color: var(--text-on-accent, #fff);
  background: var(--accent-primary);
  vertical-align: middle;
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
  padding: 8px 12px 12px;
  border-top: 1px solid var(--border-default);
}

.nav-badge {
  margin-left: auto;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--accent-subtle);
  color: var(--accent-primary);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
}

.lock-btn:hover {
  color: var(--status-danger);
}

.category-context-menu {
  position: fixed;
  z-index: 100;
  min-width: 180px;
  padding: 4px;
}

.context-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s;
}

.context-menu-item:hover:not(:disabled) {
  background: var(--bg-hover);
}

.context-menu-item--danger {
  color: var(--status-danger);
}

.context-menu-item--danger:hover:not(:disabled) {
  background: rgba(248, 113, 113, 0.08);
}

.context-menu-item--disabled,
.context-menu-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.context-menu-confirm {
  margin: 0;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--status-danger);
  line-height: 1.4;
}

.context-menu-confirm-actions {
  display: flex;
  gap: 4px;
  padding: 0 4px 4px;
}

.context-menu-confirm-actions .context-menu-item {
  flex: 1;
  justify-content: center;
}
</style>
