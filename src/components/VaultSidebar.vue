<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, Plus, Pencil, Trash2, Box, Layers, FolderOpen, Settings, Sparkles, ShieldAlert, Hash, ArchiveRestore } from 'lucide-vue-next'
import PanelEdge from '@/components/PanelEdge.vue'
import CategoryManagePanel from '@/components/CategoryManagePanel.vue'
import TagManagePanel from '@/components/TagManagePanel.vue'
import CategoryIconView from '@/components/CategoryIconView.vue'
import VaultClock from '@/components/VaultClock.vue'
import { UiInput } from '@/components/ui'
import { useTheme } from '@/composables/useTheme'
import { useAppState } from '@/composables/useAppState'
import { showToast } from '@/composables/useToast'
import { textMatchesQuery } from '@/shared/searchMatch'
import { TOUR_PREPARE_EVENT, type TourPrepareAction } from '@/shared/productTourTypes'
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
  selectedCategory,
  selectCategory,
  navigateTo,
  openPasswordGen,
  openPasswordHealth,
  openTrash,
  vaultStatus,
  reorderSidebarCategories,
  deleteCategory,
  loading,
  errorMessage,
} = useAppState()

const { t } = useI18n()
const { isAnimalIsland } = useTheme()

const categorySearchQuery = ref('')
const categoryManagePanelRef = ref<InstanceType<typeof CategoryManagePanel> | null>(null)
const tagManagePanelRef = ref<InstanceType<typeof TagManagePanel> | null>(null)
const showToolboxMenu = ref(false)
const showManageMenu = ref(false)
const sidebarNavRef = ref<HTMLElement | null>(null)
const dragFromIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
const draggingId = ref<string | null>(null)
const dragMoved = ref(false)
const suppressNextClick = ref(false)
const activePointerId = ref<number | null>(null)
const dragStartPoint = ref<{ x: number; y: number } | null>(null)
const contextMenu = ref<{ category: SidebarCategoryItem; x: number; y: number; confirmDelete: boolean } | null>(null)
const contextMenuRef = ref<HTMLElement | null>(null)
const BODY_DRAG_CLASS = 'category-drag-active'
const DRAG_ACTIVATION_PX = 15
const VIEWPORT_MENU_PADDING = 8

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
  document.removeEventListener('pointermove', onResizeMove)
  document.removeEventListener('pointerup', stopResize)
  document.removeEventListener('pointercancel', stopResize)
  window.dispatchEvent(new Event('resize'))
}

function onResizeMove(event: PointerEvent): void {
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

function onResizeStart(event: PointerEvent): void {
  if (sidebarCollapsed.value || event.button !== 0) return
  isResizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('pointermove', onResizeMove)
  document.addEventListener('pointerup', stopResize)
  document.addEventListener('pointercancel', stopResize)
}

function onVaultLayoutResize(): void {
  clampSidebarWidth()
}

function isCustomCategory(id: string): boolean {
  return id !== 'all' && id !== 'favorite' && id !== 'attachments'
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

function closeFooterMenus(): void {
  showToolboxMenu.value = false
  showManageMenu.value = false
}

function toggleToolboxMenu(event: MouseEvent): void {
  event.stopPropagation()
  showManageMenu.value = false
  showToolboxMenu.value = !showToolboxMenu.value
}

function toggleManageMenu(event: MouseEvent): void {
  event.stopPropagation()
  showToolboxMenu.value = false
  showManageMenu.value = !showManageMenu.value
}

function openCategoryManage(): void {
  closeFooterMenus()
  categoryManagePanelRef.value?.openManageDialog()
}

function openTagManage(): void {
  closeFooterMenus()
  tagManagePanelRef.value?.openManageDialog()
}

function handleToolPasswordGen(): void {
  closeFooterMenus()
  openPasswordGen()
}

function handleToolPasswordHealth(): void {
  closeFooterMenus()
  openPasswordHealth()
}

function handleToolTrash(): void {
  closeFooterMenus()
  openTrash()
}

function openSettings(): void {
  closeFooterMenus()
  navigateTo('settings')
}

function isProductTourActive(): boolean {
  return document.documentElement.classList.contains('product-tour-active')
}

function onTourPrepare(event: Event): void {
  const action = (event as CustomEvent<{ action: TourPrepareAction }>).detail?.action
  if (action === 'expand-utilities' || action === 'expand-toolbox') {
    showManageMenu.value = false
    showToolboxMenu.value = true
  }
  if (action === 'expand-manage') {
    showToolboxMenu.value = false
    showManageMenu.value = true
  }
  if (action === 'collapse-footer-menus') {
    closeFooterMenus()
  }
}

function onDocumentClick(): void {
  if (isProductTourActive()) return
  closeContextMenu()
  closeFooterMenus()
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    closeContextMenu()
    closeFooterMenus()
  }
}

function openCreateCategory(): void {
  categoryManagePanelRef.value?.openCreateDialog()
}

const isDragging = computed(() => dragFromIndex.value !== null && dragMoved.value)

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
  dragStartPoint.value = null
}

function beginCategoryDrag(categoryId: FilterCategory, pointerId: number, captureTarget: HTMLElement): void {
  window.getSelection()?.removeAllRanges()

  const index = categories.value.findIndex((category) => category.id === categoryId)
  if (index < 0) return

  captureTarget.setPointerCapture(pointerId)
  activePointerId.value = pointerId
  dragFromIndex.value = index
  dragOverIndex.value = index
  draggingId.value = categoryId
  dragMoved.value = false

  document.addEventListener('pointermove', onDocumentPointerMove, { passive: false })
  document.addEventListener('pointerup', onDocumentPointerUp)
  document.addEventListener('pointercancel', onDocumentPointerUp)
}

function hasExceededDragThreshold(clientX: number, clientY: number): boolean {
  const start = dragStartPoint.value
  if (!start) return false
  return Math.abs(clientY - start.y) >= DRAG_ACTIVATION_PX
}

function onItemPointerDown(categoryId: FilterCategory, event: PointerEvent): void {
  if (event.button !== 0) return

  if (selectedCategory.value !== categoryId) {
    selectCategory(categoryId)
  }

  if (isCategorySearchActive.value) return

  dragStartPoint.value = { x: event.clientX, y: event.clientY }
  beginCategoryDrag(categoryId, event.pointerId, event.currentTarget as HTMLElement)
}

const AUTO_SCROLL_EDGE_PX = 36
const AUTO_SCROLL_MIN_STEP = 4
const AUTO_SCROLL_MAX_STEP = 18

function autoScrollNav(clientY: number): void {
  const nav = sidebarNavRef.value
  if (!nav) return

  const rect = nav.getBoundingClientRect()
  if (clientY < rect.top + AUTO_SCROLL_EDGE_PX) {
    const intensity = 1 - Math.max(0, clientY - rect.top) / AUTO_SCROLL_EDGE_PX
    nav.scrollTop -= Math.ceil(AUTO_SCROLL_MIN_STEP + intensity * AUTO_SCROLL_MAX_STEP)
    return
  }
  if (clientY > rect.bottom - AUTO_SCROLL_EDGE_PX) {
    const intensity = 1 - Math.max(0, rect.bottom - clientY) / AUTO_SCROLL_EDGE_PX
    nav.scrollTop += Math.ceil(AUTO_SCROLL_MIN_STEP + intensity * AUTO_SCROLL_MAX_STEP)
  }
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

function onDocumentPointerMove(event: PointerEvent): void {
  if (dragFromIndex.value === null) return
  if (activePointerId.value !== null && event.pointerId !== activePointerId.value) return
  if (!dragMoved.value && !hasExceededDragThreshold(event.clientX, event.clientY)) return

  event.preventDefault()
  if (!dragMoved.value) {
    dragMoved.value = true
    document.body.classList.add(BODY_DRAG_CLASS)
    document.body.style.userSelect = 'none'
  }
  autoScrollNav(event.clientY)
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
  window.addEventListener(TOUR_PREPARE_EVENT, onTourPrepare)
})

onBeforeUnmount(() => {
  cleanupDrag()
  stopResize()
  window.removeEventListener('resize', onVaultLayoutResize)
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
  window.removeEventListener(TOUR_PREPARE_EVENT, onTourPrepare)
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
    <div
      v-if="!sidebarCollapsed"
      class="sidebar-main"
    >
      <div class="sidebar-top">
        <VaultClock />
      </div>

      <div class="category-search-wrap">
        <div class="category-search-row">
          <div class="search-field-wrap">
            <Search
              v-if="!isAnimalIsland"
              class="search-field-icon"
              :size="14"
              :stroke-width="1.5"
            />
            <UiInput
              v-model="categorySearchQuery"
              class="search-field-input"
              :class="{ 'search-field-input--animal': isAnimalIsland }"
              :placeholder="t('vault.categorySearchPlaceholder')"
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
          <button
            type="button"
            class="category-add-btn"
            data-tour="sidebar-new-category"
            :title="t('category.newCategory')"
            :aria-label="t('category.newCategory')"
            @click="openCreateCategory"
          >
            <Plus
              :size="16"
              :stroke-width="1.5"
            />
          </button>
        </div>
      </div>

      <nav
        ref="sidebarNavRef"
        class="sidebar-nav"
        data-tour="sidebar-categories"
      >
        <TransitionGroup
          name="sort"
          tag="div"
          class="sort-list"
        >
          <div
            v-for="cat in displayCategories"
            :key="cat.id"
            class="nav-item sortable sortable-row"
            :class="{
              active: selectedCategory === cat.id,
              'is-dragging': draggingId === cat.id && dragMoved,
            }"
            role="button"
            tabindex="0"
            :title="!isCategorySearchActive ? t('vault.dragSort') : undefined"
            @selectstart.prevent
            @pointerdown="onItemPointerDown(cat.id as FilterCategory, $event)"
            @click="onNavClick(cat.id as FilterCategory, $event)"
            @keydown.enter="selectCategory(cat.id as FilterCategory)"
            @contextmenu="handleCategoryContextMenu(cat, $event)"
          >
            <CategoryIconView
              :name="cat.icon"
              :badge-size="24"
              :size="14"
            />
            <span class="nav-label">{{ cat.label }}</span>
            <span
              class="count"
              :class="{ active: selectedCategory === cat.id }"
            >{{ cat.count }}</span>
          </div>
        </TransitionGroup>
      </nav>

      <footer
        class="sidebar-footer"
        data-tour="sidebar-utilities"
      >
        <div class="sidebar-footer-rail">
          <div class="sidebar-footer-slot">
            <button
              type="button"
              class="sidebar-icon-btn sidebar-icon-btn--toolbox"
              :class="{ 'sidebar-icon-btn--active': showToolboxMenu }"
              data-tour="sidebar-toolbox"
              :data-tip="t('tools.toolbox')"
              :aria-label="t('tools.toolbox')"
              :aria-expanded="showToolboxMenu"
              @click="toggleToolboxMenu"
            >
              <Box
                :size="16"
                :stroke-width="1.75"
              />
            </button>
            <Transition name="sidebar-footer-popover">
              <div
                v-if="showToolboxMenu"
                class="sidebar-footer-popover sidebar-footer-popover--menu"
                data-tour="sidebar-toolbox-panel"
                @click.stop
              >
                <button
                  type="button"
                  class="sidebar-menu-item sidebar-menu-item--gen"
                  data-tour="tool-password-gen"
                  @click="handleToolPasswordGen"
                >
                  <Sparkles
                    :size="14"
                    :stroke-width="1.75"
                  />
                  <span class="sidebar-menu-item-label">{{ t('tools.passwordGenTitle') }}</span>
                </button>
                <button
                  type="button"
                  class="sidebar-menu-item sidebar-menu-item--health"
                  data-tour="tool-password-health"
                  @click="handleToolPasswordHealth"
                >
                  <ShieldAlert
                    :size="14"
                    :stroke-width="1.75"
                  />
                  <span class="sidebar-menu-item-label">{{ t('tools.passwordHealth.title') }}</span>
                </button>
              </div>
            </Transition>
          </div>

          <div class="sidebar-footer-slot">
            <button
              type="button"
              class="sidebar-icon-btn sidebar-icon-btn--manage"
              :class="{ 'sidebar-icon-btn--active': showManageMenu }"
              data-tour="sidebar-manage"
              :data-tip="t('tools.manageGroup')"
              :aria-label="t('tools.manageGroup')"
              :aria-expanded="showManageMenu"
              @click="toggleManageMenu"
            >
              <Layers
                :size="16"
                :stroke-width="1.75"
              />
            </button>
            <Transition name="sidebar-footer-popover">
              <div
                v-if="showManageMenu"
                class="sidebar-footer-popover sidebar-footer-popover--menu"
                data-tour="sidebar-manage-panel"
                @click.stop
              >
                <button
                  type="button"
                  class="sidebar-menu-item sidebar-menu-item--category"
                  @click="openCategoryManage"
                >
                  <FolderOpen
                    :size="14"
                    :stroke-width="1.75"
                  />
                  <span class="sidebar-menu-item-label">{{ t('category.manage') }}</span>
                </button>
                <button
                  type="button"
                  class="sidebar-menu-item sidebar-menu-item--tag"
                  @click="openTagManage"
                >
                  <Hash
                    :size="14"
                    :stroke-width="1.75"
                  />
                  <span class="sidebar-menu-item-label">{{ t('tag.manage') }}</span>
                </button>
              </div>
            </Transition>
          </div>

          <div class="sidebar-footer-slot">
            <button
              type="button"
              class="sidebar-icon-btn sidebar-icon-btn--trash"
              :data-tip="t('vault.trash')"
              :aria-label="t('vault.trash')"
              data-tour="tool-trash"
              @click="handleToolTrash"
            >
              <ArchiveRestore
                :size="16"
                :stroke-width="1.75"
              />
              <span
                v-if="vaultStatus.trashCount > 0"
                class="sidebar-icon-btn-badge"
              >{{ vaultStatus.trashCount > 99 ? '99+' : vaultStatus.trashCount }}</span>
            </button>
          </div>

          <div class="sidebar-footer-slot">
            <button
              type="button"
              class="sidebar-icon-btn sidebar-icon-btn--settings"
              :data-tip="t('vault.settings')"
              :aria-label="t('titlebar.openSettings')"
              data-tour="sidebar-settings"
              @click="openSettings"
            >
              <Settings
                :size="16"
                :stroke-width="1.75"
              />
            </button>
          </div>
        </div>
      </footer>

      <CategoryManagePanel
        ref="categoryManagePanelRef"
        :show-trigger="false"
      />
      <TagManagePanel
        ref="tagManagePanelRef"
        :show-trigger="false"
      />
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
        <button
          type="button"
          class="context-menu-item"
          @click="handleEditCategory"
        >
          <Pencil
            :size="14"
            :stroke-width="1.5"
          />
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
          <Trash2
            :size="14"
            :stroke-width="1.5"
          />
          {{ t('common.delete') }}
        </button>
      </template>
      <template v-else>
        <p class="context-menu-confirm">
          {{ t('category.deleteConfirm', { name: contextMenu.category.label }) }}
        </p>
        <div class="context-menu-confirm-actions">
          <button
            type="button"
            class="context-menu-item"
            @click="cancelContextDelete"
          >
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

.sidebar.is-sorting .nav-item.sortable:not(.is-dragging) {
  cursor: pointer;
}

.sidebar.is-sorting .nav-item.sortable:not(.is-dragging),
.sidebar.is-sorting .sort-move {
  transition: none;
}

.sidebar-top {
  flex-shrink: 0;
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
  flex: 1 1 0;
  min-height: 0;
  padding: 0 12px 12px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  user-select: none;
  -webkit-user-select: none;
}

.sort-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
}

.sort-move {
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.nav-item.sortable {
  user-select: none;
  -webkit-user-select: none;
  position: relative;
  max-width: 100%;
  touch-action: pan-y;
}

.nav-item.is-dragging {
  cursor: grab;
  z-index: 2;
  opacity: 0.96;
  background: var(--bg-elevated);
  box-shadow:
    inset 0 0 0 1px var(--border-accent),
    0 8px 20px rgba(15, 23, 42, 0.1);
}

.nav-item.is-dragging.active {
  background: var(--bg-elevated);
  color: var(--text-primary);
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

.sidebar-footer {
  flex-shrink: 0;
  position: relative;
  z-index: 4;
  padding: 6px 12px 8px;
  border-top: 1px solid color-mix(in srgb, var(--accent-primary) 16%, var(--border-default));
}

.sidebar-footer-rail {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
}

.sidebar-footer-slot {
  position: relative;
  min-width: 0;
  display: flex;
}

.sidebar-icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    transform 0.12s ease;
}

.sidebar-icon-btn:hover {
  background: color-mix(in srgb, var(--accent-muted) 40%, var(--bg-hover));
}

.sidebar-icon-btn:active {
  transform: scale(0.94);
}

.sidebar-icon-btn--active {
  background: color-mix(in srgb, var(--accent-muted) 55%, transparent);
}

.sidebar-icon-btn--toolbox {
  color: #7c3aed;
}

.sidebar-icon-btn--manage {
  color: #0d9488;
}

.sidebar-icon-btn--category {
  color: #0891b2;
}

.sidebar-icon-btn--tag {
  color: #ea580c;
}

.sidebar-icon-btn--gen {
  color: #ca8a04;
}

.sidebar-icon-btn--health {
  color: #059669;
}

.sidebar-icon-btn--trash {
  color: #dc2626;
}

.sidebar-icon-btn--settings {
  color: #64748b;
}

.sidebar-icon-btn-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 99px;
  font-size: 9px;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
  color: #fff;
  background: #dc2626;
  box-shadow: 0 0 0 1.5px var(--bg-surface);
  pointer-events: none;
}

.sidebar-icon-btn[data-tip]::after {
  content: attr(data-tip);
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  z-index: 30;
  max-width: 120px;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}

.sidebar-icon-btn[data-tip]:hover::after,
.sidebar-icon-btn[data-tip]:focus-visible::after {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.sidebar-footer-popover {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  z-index: 25;
  min-width: 100%;
  padding: 4px;
  border-radius: 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  box-shadow:
    0 4px 6px rgba(15, 23, 42, 0.05),
    0 10px 24px rgba(15, 23, 42, 0.1);
}

.sidebar-footer-popover--menu {
  width: max(100%, 168px);
}

.sidebar-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border: none;
  border-radius: var(--radius-md, 8px);
  background: transparent;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s;
}

.sidebar-menu-item:hover {
  background: var(--bg-hover);
}

.sidebar-menu-item-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-weight: 500;
}

.sidebar-menu-item--gen {
  color: #ca8a04;
}

.sidebar-menu-item--health {
  color: #059669;
}

.sidebar-menu-item--category {
  color: #0891b2;
}

.sidebar-menu-item--tag {
  color: #ea580c;
}

.sidebar-footer-popover-enter-active,
.sidebar-footer-popover-leave-active {
  transition:
    opacity 0.14s ease,
    transform 0.14s ease;
}

.sidebar-footer-popover-enter-from,
.sidebar-footer-popover-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.sidebar--animal .sidebar-footer {
  padding: 6px 10px 8px;
}

.sidebar--animal .sidebar-icon-btn {
  width: 30px;
  height: 30px;
  border-radius: 10px;
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
