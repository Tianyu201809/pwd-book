<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronRight } from 'lucide-vue-next'
import CategoryIconView from '@/components/CategoryIconView.vue'
import { useAppState } from '@/composables/useAppState'
import type { PasswordEntry } from '@/types'

const props = defineProps<{
  entry: PasswordEntry
}>()

const emit = defineEmits<{
  action: []
}>()

const { t } = useI18n()
const {
  customCategories,
  openEntryInBrowser,
  copyEntryData,
  removeEntry,
  moveEntryToCategory,
  toggleFavorite,
} = useAppState()

const moveTargets = computed(() =>
  customCategories.value.filter((category) => category.id !== props.entry.categoryId),
)

function done(): void {
  emit('action')
}

async function handleOpenInBrowser(event: MouseEvent): Promise<void> {
  event.stopPropagation()
  done()
  await openEntryInBrowser(props.entry)
}

async function handleCopy(event: MouseEvent): Promise<void> {
  event.stopPropagation()
  done()
  await copyEntryData(props.entry)
}

async function handleToggleFavorite(event: MouseEvent): Promise<void> {
  event.stopPropagation()
  done()
  await toggleFavorite(props.entry.id)
}

async function handleDelete(event: MouseEvent): Promise<void> {
  event.stopPropagation()
  done()
  if (!window.confirm(t('vault.deleteConfirm', { title: props.entry.title }))) return
  await removeEntry(props.entry.id)
}

async function handleMove(categoryId: string, event: MouseEvent): Promise<void> {
  event.stopPropagation()
  done()
  await moveEntryToCategory(props.entry.id, categoryId)
}

function canOpenInBrowser(): boolean {
  return Boolean(props.entry.url.trim())
}

const moveSubmenuOpen = ref(false)
const moveSubmenuWrapRef = ref<HTMLElement | null>(null)
const moveSubmenuStyle = ref<Record<string, string>>({})
let moveSubmenuCloseTimer: ReturnType<typeof setTimeout> | null = null

const SUBMENU_ITEM_HEIGHT = 36
const SUBMENU_PADDING = 8
const SUBMENU_MAX_VISIBLE_ITEMS = 5
const SUBMENU_MAX_HEIGHT = SUBMENU_MAX_VISIBLE_ITEMS * SUBMENU_ITEM_HEIGHT + SUBMENU_PADDING
const SUBMENU_MIN_WIDTH = 168
const VIEWPORT_PADDING = 8
const SUBMENU_GAP = 4

function getSubmenuVisibleHeight(itemCount: number): number {
  if (itemCount === 0) return SUBMENU_ITEM_HEIGHT
  const visibleCount = Math.min(itemCount, SUBMENU_MAX_VISIBLE_ITEMS)
  return visibleCount * SUBMENU_ITEM_HEIGHT + SUBMENU_PADDING
}

function adjustMoveSubmenuPosition(): void {
  const wrap = moveSubmenuWrapRef.value
  if (!wrap || !moveSubmenuOpen.value) return

  const triggerRect = wrap.getBoundingClientRect()
  const estimatedHeight = getSubmenuVisibleHeight(moveTargets.value.length)

  let left = triggerRect.right + SUBMENU_GAP
  if (left + SUBMENU_MIN_WIDTH > window.innerWidth - VIEWPORT_PADDING) {
    left = Math.max(VIEWPORT_PADDING, triggerRect.left - SUBMENU_GAP - SUBMENU_MIN_WIDTH)
  }

  const spaceBelow = window.innerHeight - triggerRect.top - VIEWPORT_PADDING
  const spaceAbove = triggerRect.bottom - VIEWPORT_PADDING
  const openDownward = estimatedHeight <= spaceBelow || spaceBelow >= spaceAbove

  let maxHeight: number
  let top: number

  if (openDownward) {
    maxHeight = Math.min(SUBMENU_MAX_HEIGHT, spaceBelow)
    top = triggerRect.top
  } else {
    maxHeight = Math.min(SUBMENU_MAX_HEIGHT, spaceAbove)
    top = triggerRect.bottom - Math.min(estimatedHeight, maxHeight)
  }

  top = Math.max(VIEWPORT_PADDING, Math.min(top, window.innerHeight - maxHeight - VIEWPORT_PADDING))

  moveSubmenuStyle.value = {
    position: 'fixed',
    left: `${left}px`,
    top: `${top}px`,
    maxHeight: `${maxHeight}px`,
  }
}

function cancelCloseMoveSubmenu(): void {
  if (moveSubmenuCloseTimer) {
    clearTimeout(moveSubmenuCloseTimer)
    moveSubmenuCloseTimer = null
  }
}

async function openMoveSubmenu(): Promise<void> {
  cancelCloseMoveSubmenu()
  if (moveSubmenuOpen.value) return

  moveSubmenuOpen.value = true
  await nextTick()
  adjustMoveSubmenuPosition()
}

function scheduleCloseMoveSubmenu(): void {
  if (moveSubmenuCloseTimer) clearTimeout(moveSubmenuCloseTimer)
  moveSubmenuCloseTimer = setTimeout(() => {
    moveSubmenuOpen.value = false
    moveSubmenuStyle.value = {}
    moveSubmenuCloseTimer = null
  }, 120)
}
</script>

<template>
  <button
    type="button"
    class="action-menu-item"
    :disabled="!canOpenInBrowser()"
    @click="handleOpenInBrowser"
  >
    {{ t('vault.openWithCredentials') }}
  </button>
  <button type="button" class="action-menu-item" @click="handleCopy">
    {{ t('vault.copyData') }}
  </button>
  <button type="button" class="action-menu-item" @click="handleToggleFavorite">
    {{ entry.isFavorite ? t('detail.removeFavorite') : t('detail.addFavorite') }}
  </button>

  <div
    ref="moveSubmenuWrapRef"
    class="menu-item-submenu"
    @click.stop
    @mouseenter="openMoveSubmenu"
    @mouseleave="scheduleCloseMoveSubmenu"
  >
    <button type="button" class="action-menu-item submenu-trigger">
      <span>{{ t('vault.moveTo') }}</span>
      <ChevronRight :size="14" :stroke-width="2" class="submenu-chevron" />
    </button>
    <div
      class="submenu menu-popover surface-card"
      :class="{ open: moveSubmenuOpen }"
      :style="moveSubmenuStyle"
      @mouseenter="cancelCloseMoveSubmenu"
      @mouseleave="scheduleCloseMoveSubmenu"
    >
      <p v-if="moveTargets.length === 0" class="submenu-empty">{{ t('vault.noOtherCategory') }}</p>
      <button
        v-for="category in moveTargets"
        :key="category.id"
        type="button"
        class="submenu-item"
        @click="handleMove(category.id, $event)"
      >
        <CategoryIconView :name="category.icon" :badge-size="22" :size="12" />
        <span class="submenu-label">{{ category.label }}</span>
      </button>
    </div>
  </div>

  <button type="button" class="action-menu-item danger" @click="handleDelete">
    {{ t('common.delete') }}
  </button>
</template>

<style scoped>
.action-menu-item {
  width: 100%;
  display: block;
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

.action-menu-item:hover:not(:disabled) {
  background: var(--bg-hover);
}

.action-menu-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.action-menu-item.danger {
  color: var(--status-danger);
}

.action-menu-item.danger:hover:not(:disabled) {
  background: rgba(248, 113, 113, 0.08);
}

.menu-item-submenu {
  position: relative;
}

/* 填补主菜单与子菜单之间的空隙，避免移入时 hover 断开 */
.menu-item-submenu::before {
  content: '';
  position: absolute;
  left: 100%;
  top: 0;
  width: 12px;
  height: 100%;
  z-index: 119;
}

.submenu-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.submenu-chevron {
  flex-shrink: 0;
  color: var(--text-muted);
}

.submenu {
  display: none;
  min-width: 168px;
  max-width: 220px;
  overflow-y: auto;
  padding: 4px;
  z-index: 130;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--scrollbar-thumb) 42%, transparent) transparent;
}

.submenu::-webkit-scrollbar {
  width: 2px;
}

.submenu::-webkit-scrollbar-track {
  background: transparent;
  margin: 6px 0;
}

.submenu::-webkit-scrollbar-thumb {
  background-color: color-mix(in srgb, var(--scrollbar-thumb) 38%, transparent);
  border-radius: 99px;
  min-height: 28px;
}

.submenu:hover::-webkit-scrollbar-thumb {
  background-color: color-mix(in srgb, var(--scrollbar-thumb) 58%, transparent);
}

.submenu.open {
  display: block;
}

.submenu-empty {
  margin: 0;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-muted);
}

.submenu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
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

.submenu-item:hover {
  background: var(--bg-hover);
}

.submenu-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
