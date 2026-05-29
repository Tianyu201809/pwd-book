<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Settings, Lock, GripVertical } from 'lucide-vue-next'
import CategoryManagePanel from '@/components/CategoryManagePanel.vue'
import CategoryIconView from '@/components/CategoryIconView.vue'
import { useAppState } from '@/composables/useAppState'
import type { FilterCategory } from '@/types'

const {
  categories,
  selectedCategory,
  selectCategory,
  navigateTo,
  lock,
  startCreateEntry,
  reorderSidebarCategories,
} = useAppState()

const { t } = useI18n()

const sidebarNavRef = ref<HTMLElement | null>(null)
const dragFromIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
const draggingId = ref<string | null>(null)
const dragMoved = ref(false)
const suppressNextClick = ref(false)
const activePointerId = ref<number | null>(null)

const BODY_DRAG_CLASS = 'category-drag-active'

const isDragging = computed(() => dragFromIndex.value !== null)

const displayCategories = computed(() => {
  const items = [...categories.value]
  const from = dragFromIndex.value
  const to = dragOverIndex.value
  if (from === null || to === null || from === to) return items

  const [moved] = items.splice(from, 1)
  items.splice(to, 0, moved)
  return items
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

onBeforeUnmount(() => {
  cleanupDrag()
})
</script>

<template>
  <aside class="sidebar" :class="{ 'is-sorting': isDragging }">
    <div class="sidebar-top">
      <button type="button" class="btn-primary new-btn" @click="startCreateEntry">
        <Plus :size="16" :stroke-width="1.5" />
        {{ t('vault.newEntry') }}
      </button>
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
          }"
          role="button"
          tabindex="0"
          @selectstart.prevent
          @click="onNavClick(cat.id as FilterCategory, $event)"
          @keydown.enter="selectCategory(cat.id as FilterCategory)"
        >
          <span
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

    <div class="sidebar-bottom">
      <CategoryManagePanel />
      <button type="button" class="nav-item" @click="navigateTo('settings')">
        <Settings :size="16" :stroke-width="1.5" />
        {{ t('vault.settings') }}
      </button>
      <button type="button" class="nav-item lock-btn" @click="lock">
        <Lock :size="16" :stroke-width="1.5" />
        {{ t('vault.lock') }}
      </button>
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

.sidebar-top {
  padding: 16px;
}

.new-btn {
  width: 100%;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
}

.sidebar-nav {
  flex: 1;
  padding: 0 12px;
  overflow-y: auto;
  user-select: none;
  -webkit-user-select: none;
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
  padding: 12px;
  border-top: 1px solid var(--border-default);
}

.lock-btn:hover {
  color: var(--status-danger);
}
</style>
