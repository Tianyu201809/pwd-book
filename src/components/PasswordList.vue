<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, SlidersHorizontal, MoreHorizontal, Check, Plus, Star } from 'lucide-vue-next'
import CategoryIconView from '@/components/CategoryIconView.vue'
import EntryListMenu from '@/components/EntryListMenu.vue'
import { UiInput, UiButton } from '@/components/ui'
import { useTheme } from '@/composables/useTheme'
import { useAppState } from '@/composables/useAppState'
import { getAvatarMeta } from '@/shared/utils'
import type { ListSortOrder, PasswordEntry } from '@/types'

const {
  displayEntries,
  selectedEntryId,
  searchQuery,
  listSortOrder,
  selectEntry,
  isCreating,
  setListSortOrder,
  touchActivity,
  startCreateEntry,
} = useAppState()

const { t } = useI18n()
const { isAnimalIsland } = useTheme()

const sortOptions = computed(() => [
  { id: 'recent' as ListSortOrder, label: t('vault.sortRecent') },
  { id: 'title' as ListSortOrder, label: t('vault.sortTitle') },
  { id: 'created' as ListSortOrder, label: t('vault.sortCreated') },
])

const openMenuId = ref<string | null>(null)
const showSortMenu = ref(false)
const contextMenu = ref<{ entry: PasswordEntry; x: number; y: number } | null>(null)
const contextMenuRef = ref<HTMLElement | null>(null)
const listPanelRef = ref<HTMLElement | null>(null)
const isCompactList = ref(false)

/** 宽度不足时隐藏次要信息，避免右侧时间戳挤占导致标题被裁切 */
const LIST_COMPACT_WIDTH = 400

let listResizeObserver: ResizeObserver | null = null

function toggleMenu(id: string, event: MouseEvent): void {
  event.stopPropagation()
  showSortMenu.value = false
  contextMenu.value = null
  openMenuId.value = openMenuId.value === id ? null : id
}

function toggleSortMenu(event: MouseEvent): void {
  event.stopPropagation()
  openMenuId.value = null
  contextMenu.value = null
  showSortMenu.value = !showSortMenu.value
}

function closeMenus(): void {
  openMenuId.value = null
  showSortMenu.value = false
  contextMenu.value = null
}

function onDocumentClick(): void {
  closeMenus()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeMenus()
}

function updateCompactList(width: number): void {
  isCompactList.value = width < LIST_COMPACT_WIDTH
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)

  listResizeObserver = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width ?? 0
    updateCompactList(width)
  })
  if (listPanelRef.value) {
    listResizeObserver.observe(listPanelRef.value)
    updateCompactList(listPanelRef.value.getBoundingClientRect().width)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
  listResizeObserver?.disconnect()
  listResizeObserver = null
})

watch(listPanelRef, (el) => {
  if (!listResizeObserver) return
  listResizeObserver.disconnect()
  if (el) {
    listResizeObserver.observe(el)
    updateCompactList(el.getBoundingClientRect().width)
  }
})

function handleSelect(id: string): void {
  closeMenus()
  selectEntry(id)
}

function handleSort(order: ListSortOrder, event: MouseEvent): void {
  event.stopPropagation()
  setListSortOrder(order)
  closeMenus()
}

const VIEWPORT_MENU_PADDING = 8

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

function handleContextMenu(entry: PasswordEntry, event: MouseEvent): void {
  event.preventDefault()
  event.stopPropagation()
  openMenuId.value = null
  showSortMenu.value = false
  contextMenu.value = {
    entry,
    x: event.clientX,
    y: event.clientY,
  }
  nextTick(adjustContextMenuPosition)
}
</script>

<template>
  <main ref="listPanelRef" class="list-panel" :class="{ 'list-panel--compact': isCompactList }">
    <div class="list-toolbar">
      <div class="search-wrap">
        <Search v-if="!isAnimalIsland" class="search-icon" :size="16" :stroke-width="1.5" />
        <UiInput
          v-model="searchQuery"
          class="search-input"
          :class="{ 'search-input--animal': isAnimalIsland }"
          :placeholder="t('vault.searchPlaceholder')"
          allow-clear
          @update:model-value="touchActivity"
        >
          <template v-if="isAnimalIsland" #prefix>
            <Search :size="16" :stroke-width="1.5" />
          </template>
        </UiInput>
      </div>
      <UiButton
        variant="primary"
        class="vault-new-btn"
        :class="{ 'new-entry-btn': !isAnimalIsland }"
        @click="startCreateEntry"
      >
        <template #icon><Plus :size="16" :stroke-width="1.5" /></template>
        {{ t('vault.newEntry') }}
      </UiButton>
      <div class="sort-menu-wrap">
        <UiButton
          :variant="isAnimalIsland ? 'primary' : 'ghost'"
          class="vault-filter-btn"
          :class="{
            'filter-btn': !isAnimalIsland,
            active: showSortMenu && !isAnimalIsland,
            'vault-filter-btn--active': showSortMenu && isAnimalIsland,
          }"
          :title="t('vault.sortBy')"
          :aria-label="t('vault.sortBy')"
          @click="toggleSortMenu"
        >
          <template #icon><SlidersHorizontal :size="16" :stroke-width="1.5" /></template>
        </UiButton>
        <div v-if="showSortMenu" class="sort-menu surface-card" @click.stop>
          <p class="sort-menu-title">{{ t('vault.sortBy') }}</p>
          <button
            v-for="option in sortOptions"
            :key="option.id"
            type="button"
            class="sort-menu-item"
            :class="{ active: listSortOrder === option.id }"
            @click="handleSort(option.id, $event)"
          >
            {{ option.label }}
            <Check v-if="listSortOrder === option.id" :size="14" :stroke-width="2" />
          </button>
        </div>
      </div>
    </div>

    <div class="list-scroll" :class="{ 'list-scroll--animal': isAnimalIsland }">
      <div v-if="displayEntries.length === 0" class="empty-state">
        <p>{{ isCreating ? t('vault.emptyCreating') : t('vault.emptyNoMatch') }}</p>
      </div>

      <div
        v-for="entry in displayEntries"
        :key="entry.id"
        class="list-item"
        :class="{ 'list-item-active': !isCreating && selectedEntryId === entry.id }"
        @contextmenu="handleContextMenu(entry, $event)"
      >
        <button type="button" class="list-item-main" @click="handleSelect(entry.id)">
          <CategoryIconView
            v-if="entry.displayIcon"
            :name="entry.displayIcon"
            :badge-size="36"
            :size="16"
          />
          <div
            v-else
            class="avatar"
            :style="{ background: entry.avatar?.color ?? getAvatarMeta(entry.title).color }"
          >
            {{ entry.avatar?.text ?? getAvatarMeta(entry.title).text }}
          </div>
          <div class="meta">
            <div class="title-row">
              <span class="entry-title">{{ entry.title }}</span>
              <div v-if="entry.tags.length" class="entry-tags">
                <span v-for="(tag, index) in entry.tags" :key="`${entry.id}-tag-${index}`" class="tag">{{ tag }}</span>
              </div>
            </div>
            <div class="meta-secondary">
              <p class="username">{{ entry.username || entry.url || t('vault.noAccount') }}</p>
              <span
                v-if="!isCompactList"
                class="time"
                :title="entry.lastUsedLabel"
              >{{ entry.lastUsedLabel }}</span>
            </div>
          </div>
        </button>

        <div class="list-item-side">
          <span
            v-if="entry.isFavorite"
            class="favorite-indicator"
            :title="t('common.favorite')"
            :aria-label="t('common.favorite')"
          >
            <Star :size="14" :stroke-width="1.5" fill="currentColor" />
          </span>
          <div class="action-menu-wrap">
            <button
              type="button"
              class="action-trigger"
              @click="toggleMenu(entry.id, $event)"
            >
              <MoreHorizontal :size="16" :stroke-width="1.5" />
            </button>
            <div v-if="openMenuId === entry.id" class="action-menu surface-card" @click.stop>
              <EntryListMenu :entry="entry" @action="closeMenus" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="contextMenu"
        ref="contextMenuRef"
        class="context-menu surface-card"
        :style="{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }"
        @click.stop
      >
        <EntryListMenu :entry="contextMenu.entry" @action="closeMenus" />
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.list-panel {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-app);
}

.list-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-default);
}

.search-wrap {
  flex: 1;
  position: relative;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.search-input {
  padding: 10px 16px 10px 40px;
  font-size: 14px;
}

.search-input--animal {
  width: 100%;
  padding: 0;
  font-size: 14px;
}

.new-entry-btn {
  flex-shrink: 0;
  padding: 10px 16px;
  font-size: 14px;
  white-space: nowrap;
}

.filter-btn {
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.filter-btn.active {
  color: var(--accent-primary);
  background: var(--accent-subtle);
}

.sort-menu-wrap {
  position: relative;
}

.sort-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 30;
  min-width: 160px;
  padding: 8px;
}

.sort-menu-title {
  margin: 0 0 4px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.sort-menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.sort-menu-item:hover,
.sort-menu-item.active {
  background: var(--bg-hover);
}

.sort-menu-item.active {
  color: var(--accent-primary);
}

.list-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.empty-state {
  padding: 48px 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  border-bottom: 1px solid var(--border-default);
  transition: background-color 0.2s;
}

.list-item:hover {
  background: var(--bg-hover);
}

.list-item-active {
  background: var(--accent-subtle);
}

.list-item-main {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 0 16px 24px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.list-item-side {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-right: 16px;
  flex: 0 0 auto;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.meta {
  flex: 1;
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.entry-title {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-tags {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 4px;
}

.tag {
  flex-shrink: 0;
  white-space: nowrap;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--accent-subtle);
  color: var(--accent-primary);
  font-weight: 500;
}

.favorite-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #f59e0b;
}

.meta-secondary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
  min-width: 0;
}

.username {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time {
  flex: 0 0 auto;
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}

.list-panel--compact .list-item-main {
  padding-left: 16px;
  gap: 12px;
}

.list-panel--compact .entry-tags {
  display: none;
}

.action-menu-wrap {
  position: relative;
}

.action-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}

.action-trigger:hover,
.list-item-active .action-trigger {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.action-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 20;
  min-width: 200px;
  padding: 4px;
  overflow: visible;
}

.context-menu {
  position: fixed;
  z-index: 100;
  min-width: 200px;
  padding: 4px;
  overflow: visible;
}
</style>
