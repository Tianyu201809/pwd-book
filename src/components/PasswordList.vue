<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, SlidersHorizontal, MoreHorizontal, Check, Plus, Star, LayoutList, LayoutGrid, Hash } from 'lucide-vue-next'
import CategoryIconView from '@/components/CategoryIconView.vue'
import EntryListMenu from '@/components/EntryListMenu.vue'
import SearchHighlightText from '@/components/SearchHighlightText.vue'
import TagFilterPanel from '@/components/TagFilterPanel.vue'
import { UiInput, UiButton, UiModal } from '@/components/ui'
import { useTheme } from '@/composables/useTheme'
import { useAppState } from '@/composables/useAppState'
import { getAvatarMeta } from '@/shared/utils'
import { TOUR_PREPARE_EVENT, type TourPrepareAction } from '@/shared/productTourTypes'
import type { ListLayoutMode, ListSortOrder, PasswordEntry } from '@/types'

const {
  displayEntries,
  selectedEntryId,
  searchQuery,
  listSortOrder,
  listLayoutMode,
  selectEntry,
  isCreating,
  setListSortOrder,
  setListLayoutMode,
  touchActivity,
  startCreateEntry,
  removeEntry,
  vaultTags,
  selectedTagFilters,
} = useAppState()

const { t } = useI18n()
const { isAnimalIsland } = useTheme()

const sortOptions = computed(() => [
  { id: 'recent' as ListSortOrder, label: t('vault.sortRecent') },
  { id: 'title' as ListSortOrder, label: t('vault.sortTitle') },
  { id: 'created' as ListSortOrder, label: t('vault.sortCreated') },
])

const activeSearchQuery = computed(() => searchQuery.value.trim())

const openMenuId = ref<string | null>(null)
const showSortMenu = ref(false)
const showTagFilterMenu = ref(false)
const contextMenu = ref<{ entry: PasswordEntry; x: number; y: number } | null>(null)
const contextMenuRef = ref<HTMLElement | null>(null)
const listPanelRef = ref<HTMLElement | null>(null)
const isCompactList = ref(false)
const deleteConfirmEntry = ref<PasswordEntry | null>(null)
const showDeleteConfirm = ref(false)

/** 宽度不足时隐藏次要信息，避免右侧时间戳挤占导致标题被裁切 */
const LIST_COMPACT_WIDTH = 400

let listResizeObserver: ResizeObserver | null = null

function toggleMenu(id: string, event: MouseEvent): void {
  event.stopPropagation()
  showSortMenu.value = false
  showTagFilterMenu.value = false
  contextMenu.value = null
  openMenuId.value = openMenuId.value === id ? null : id
}

function toggleSortMenu(event: MouseEvent): void {
  event.stopPropagation()
  openMenuId.value = null
  contextMenu.value = null
  showTagFilterMenu.value = false
  showSortMenu.value = !showSortMenu.value
}

function toggleTagFilterMenu(event: MouseEvent): void {
  event.stopPropagation()
  openMenuId.value = null
  contextMenu.value = null
  showSortMenu.value = false
  showTagFilterMenu.value = !showTagFilterMenu.value
}

function closeMenus(): void {
  openMenuId.value = null
  showSortMenu.value = false
  showTagFilterMenu.value = false
  contextMenu.value = null
}

function onTourPrepare(event: Event): void {
  const action = (event as CustomEvent<{ action: TourPrepareAction }>).detail?.action
  if (action === 'expand-tag-filter') {
    showSortMenu.value = false
    showTagFilterMenu.value = true
  }
  if (action === 'collapse-list-menus') {
    closeMenus()
  }
}

function isProductTourActive(): boolean {
  return document.documentElement.classList.contains('product-tour-active')
}

function handleDeleteRequest(entry: PasswordEntry): void {
  closeMenus()
  deleteConfirmEntry.value = entry
  showDeleteConfirm.value = true
}

function cancelDeleteConfirm(): void {
  showDeleteConfirm.value = false
  deleteConfirmEntry.value = null
}

async function confirmDeleteEntry(): Promise<void> {
  const entry = deleteConfirmEntry.value
  if (!entry) return
  cancelDeleteConfirm()
  await removeEntry(entry.id)
}

function onDocumentClick(): void {
  if (document.documentElement.classList.contains('product-tour-active')) return
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
  window.addEventListener(TOUR_PREPARE_EVENT, onTourPrepare)

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
  window.removeEventListener(TOUR_PREPARE_EVENT, onTourPrepare)
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

function handleLayout(mode: ListLayoutMode): void {
  setListLayoutMode(mode)
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
  showTagFilterMenu.value = false
  selectEntry(entry.id)
  contextMenu.value = {
    entry,
    x: event.clientX,
    y: event.clientY,
  }
  nextTick(adjustContextMenuPosition)
}
</script>

<template>
  <main
    ref="listPanelRef"
    class="list-panel"
    :class="{
      'list-panel--compact': isCompactList,
      'list-panel--grid': listLayoutMode === 'grid',
    }"
  >
    <div
      class="list-toolbar"
      data-tour="list-toolbar"
    >
      <div
        class="search-wrap"
        data-tour="list-search"
      >
        <Search
          v-if="!isAnimalIsland"
          class="search-icon"
          :size="16"
          :stroke-width="1.5"
        />
        <UiInput
          v-model="searchQuery"
          class="search-input"
          :class="{ 'search-input--animal': isAnimalIsland }"
          :placeholder="t('vault.searchPlaceholder')"
          allow-clear
          @update:model-value="touchActivity"
        >
          <template
            v-if="isAnimalIsland"
            #prefix
          >
            <Search
              :size="16"
              :stroke-width="1.5"
            />
          </template>
        </UiInput>
      </div>
      <UiButton
        variant="primary"
        class="vault-new-btn"
        data-tour="list-new-entry"
        :class="{ 'new-entry-btn': !isAnimalIsland }"
        @click="startCreateEntry"
      >
        <template #icon>
          <Plus
            :size="16"
            :stroke-width="1.5"
          />
        </template>
        {{ t('vault.newEntry') }}
      </UiButton>
      <div
        class="list-toolbar-actions"
        data-tour="list-actions"
      >
        <div
          v-if="vaultTags.length"
          class="toolbar-popover-wrap"
        >
          <UiButton
            :variant="isAnimalIsland ? 'primary' : 'ghost'"
            class="vault-filter-btn toolbar-icon-btn"
            :class="{
              'filter-btn': !isAnimalIsland,
              active: showTagFilterMenu && !isAnimalIsland,
              'vault-filter-btn--active': showTagFilterMenu && isAnimalIsland,
              'toolbar-icon-btn--filtered': selectedTagFilters.length > 0,
            }"
            data-tour="list-tag-filter"
            :title="showTagFilterMenu ? t('vault.collapseTagFilter') : t('vault.expandTagFilter')"
            :aria-label="t('vault.tagFilterTitle')"
            :aria-expanded="showTagFilterMenu"
            @click="toggleTagFilterMenu"
          >
            <template #icon>
              <Hash
                :size="16"
                :stroke-width="1.5"
              />
            </template>
            <span
              v-if="selectedTagFilters.length"
              class="toolbar-icon-badge"
            >{{ selectedTagFilters.length }}</span>
          </UiButton>
          <div
            v-if="showTagFilterMenu"
            class="toolbar-popover toolbar-popover--tag surface-card"
            data-tour="list-tag-filter-panel"
            @click.stop
          >
            <p class="toolbar-popover-title">
              {{ t('vault.tagFilterTitle') }}
            </p>
            <TagFilterPanel />
          </div>
        </div>

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
            <template #icon>
              <SlidersHorizontal
                :size="16"
                :stroke-width="1.5"
              />
            </template>
          </UiButton>
          <div
            v-if="showSortMenu"
            class="sort-menu surface-card"
            @click.stop
          >
            <p class="sort-menu-title">
              {{ t('vault.sortBy') }}
            </p>
            <button
              v-for="option in sortOptions"
              :key="option.id"
              type="button"
              class="sort-menu-item"
              :class="{ active: listSortOrder === option.id }"
              @click="handleSort(option.id, $event)"
            >
              {{ option.label }}
              <Check
                v-if="listSortOrder === option.id"
                :size="14"
                :stroke-width="2"
              />
            </button>
          </div>
        </div>
        <div
          class="layout-toggle"
          role="group"
          :aria-label="t('vault.layoutToggle')"
        >
          <button
            type="button"
            class="layout-toggle-btn"
            :class="{ active: listLayoutMode === 'list' }"
            :title="t('vault.layoutList')"
            :aria-label="t('vault.layoutList')"
            :aria-pressed="listLayoutMode === 'list'"
            @click="handleLayout('list')"
          >
            <LayoutList
              :size="16"
              :stroke-width="1.5"
            />
          </button>
          <button
            type="button"
            class="layout-toggle-btn"
            :class="{ active: listLayoutMode === 'grid' }"
            :title="t('vault.layoutGrid')"
            :aria-label="t('vault.layoutGrid')"
            :aria-pressed="listLayoutMode === 'grid'"
            @click="handleLayout('grid')"
          >
            <LayoutGrid
              :size="16"
              :stroke-width="1.5"
            />
          </button>
        </div>
      </div>
    </div>

    <div
      class="list-scroll"
      :class="{
        'list-scroll--animal': isAnimalIsland,
        'list-scroll--grid': listLayoutMode === 'grid',
      }"
    >
      <div
        v-if="displayEntries.length === 0"
        class="empty-state"
      >
        <p>{{ isCreating ? t('vault.emptyCreating') : t('vault.emptyNoMatch') }}</p>
      </div>

      <div
        v-else-if="listLayoutMode === 'grid'"
        class="entry-grid"
      >
        <div
          v-for="entry in displayEntries"
          :key="entry.id"
          class="grid-tile"
          :class="{ 'grid-tile-active': !isCreating && selectedEntryId === entry.id }"
          @contextmenu="handleContextMenu(entry, $event)"
        >
          <button
            type="button"
            class="grid-tile-main"
            @click="handleSelect(entry.id)"
          >
            <div class="grid-tile-visual">
              <CategoryIconView
                v-if="entry.displayIcon"
                :name="entry.displayIcon"
                :badge-size="44"
                :size="20"
              />
              <div
                v-else
                class="grid-tile-avatar"
                :style="{ background: entry.avatar?.color ?? getAvatarMeta(entry.title).color }"
              >
                {{ entry.avatar?.text ?? getAvatarMeta(entry.title).text }}
              </div>
              <span
                v-if="entry.isFavorite"
                class="grid-tile-favorite"
                :title="t('common.favorite')"
                :aria-label="t('common.favorite')"
              >
                <Star
                  :size="11"
                  :stroke-width="1.5"
                  fill="currentColor"
                />
              </span>
            </div>
            <span class="grid-tile-title">
              <SearchHighlightText
                v-if="activeSearchQuery"
                :text="entry.title"
                :query="activeSearchQuery"
              />
              <template v-else>{{ entry.title }}</template>
            </span>
          </button>
          <div class="grid-tile-side">
            <button
              type="button"
              class="grid-tile-menu-btn"
              @click="toggleMenu(entry.id, $event)"
            >
              <MoreHorizontal
                :size="14"
                :stroke-width="1.5"
              />
            </button>
            <div
              v-if="openMenuId === entry.id"
              class="action-menu menu-popover surface-card"
              @click.stop
            >
              <EntryListMenu
                :entry="entry"
                @action="closeMenus"
                @delete="handleDeleteRequest"
              />
            </div>
          </div>
        </div>
      </div>

      <template v-else>
        <div
          v-for="entry in displayEntries"
          :key="entry.id"
          class="list-item"
          :class="{ 'list-item-active': !isCreating && selectedEntryId === entry.id }"
          @contextmenu="handleContextMenu(entry, $event)"
        >
          <button
            type="button"
            class="list-item-main"
            @click="handleSelect(entry.id)"
          >
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
                <span class="entry-title">
                  <SearchHighlightText
                    v-if="activeSearchQuery"
                    :text="entry.title"
                    :query="activeSearchQuery"
                  />
                  <template v-else>{{ entry.title }}</template>
                </span>
                <div
                  v-if="entry.tags.length"
                  class="entry-tags"
                >
                  <span
                    v-for="(tag, index) in entry.tags"
                    :key="`${entry.id}-tag-${index}`"
                    class="tag"
                  >
                    <SearchHighlightText
                      v-if="activeSearchQuery"
                      :text="tag"
                      :query="activeSearchQuery"
                    />
                    <template v-else>{{ tag }}</template>
                  </span>
                </div>
              </div>
              <div class="meta-secondary">
                <p class="username">
                  <SearchHighlightText
                    v-if="activeSearchQuery && (entry.username || entry.url)"
                    :text="entry.username || entry.url"
                    :query="activeSearchQuery"
                  />
                  <template v-else>
                    {{ entry.username || entry.url || t('vault.noAccount') }}
                  </template>
                </p>
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
              <Star
                :size="14"
                :stroke-width="1.5"
                fill="currentColor"
              />
            </span>
            <div class="action-menu-wrap">
              <button
                type="button"
                class="action-trigger"
                @click="toggleMenu(entry.id, $event)"
              >
                <MoreHorizontal
                  :size="16"
                  :stroke-width="1.5"
                />
              </button>
              <div
                v-if="openMenuId === entry.id"
                class="action-menu menu-popover surface-card"
                @click.stop
              >
                <EntryListMenu
                  :entry="entry"
                  @action="closeMenus"
                  @delete="handleDeleteRequest"
                />
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <Teleport to="body">
      <div
        v-if="contextMenu"
        ref="contextMenuRef"
        class="context-menu menu-popover surface-card"
        :style="{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }"
        @click.stop
      >
        <EntryListMenu
          :entry="contextMenu.entry"
          @action="closeMenus"
          @delete="handleDeleteRequest"
        />
      </div>
    </Teleport>

    <UiModal
      v-model:open="showDeleteConfirm"
      :title="t('common.delete')"
      :width="400"
      :show-footer="false"
      @close="cancelDeleteConfirm"
    >
      <p class="confirm-modal-body delete-confirm-text">
        {{ t('vault.deleteConfirm', { title: deleteConfirmEntry?.title ?? '' }) }}
      </p>
      <template #footer>
        <div class="confirm-modal-actions">
          <UiButton
            variant="default"
            @click="cancelDeleteConfirm"
          >
            {{ t('common.cancel') }}
          </UiButton>
          <UiButton
            variant="primary"
            @click="confirmDeleteEntry"
          >
            {{ t('common.confirm') }}
          </UiButton>
        </div>
      </template>
    </UiModal>
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

.list-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
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
  pointer-events: none;
  z-index: 1;
}

.search-wrap :deep(.input-field) {
  padding: 10px 16px 10px 40px;
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

.toolbar-popover-wrap {
  position: relative;
}

.toolbar-icon-btn {
  position: relative;
}

.toolbar-icon-btn--filtered:not(.active):not(.vault-filter-btn--active) {
  color: var(--accent-primary);
}

.toolbar-icon-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 99px;
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  color: var(--text-on-accent, #fff);
  background: var(--accent-primary);
  pointer-events: none;
}

.toolbar-popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 40;
  padding: 10px;
  border-radius: var(--radius-lg, 12px);
}

.toolbar-popover--tag {
  width: min(280px, calc(100vw - 48px));
  max-height: min(360px, 52vh);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.toolbar-popover-title {
  margin: 0 0 8px;
  padding: 2px 4px 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
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

.list-item:hover:not(.list-item-active) {
  background: var(--bg-hover);
}

.list-item.list-item-active,
.list-item.list-item-active:hover {
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
  gap: 5px;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

.entry-title {
  flex: 0 1 auto;
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

.delete-confirm-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.confirm-modal-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.confirm-modal-actions :deep(.ui-classic-btn) {
  min-width: 96px;
  padding: 10px 22px;
}

.layout-toggle {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 3px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  gap: 2px;
}

.layout-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s, box-shadow 0.15s;
}

.layout-toggle-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.layout-toggle-btn.active {
  color: var(--accent-primary);
  background: var(--accent-subtle);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-primary) 25%, transparent);
}

.list-scroll--grid {
  overflow-x: hidden;
}

.entry-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 10px;
  padding: 16px 20px 20px;
}

.grid-tile {
  position: relative;
  min-width: 0;
  aspect-ratio: 1;
  border-radius: 14px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
  transition: border-color 0.2s, background-color 0.2s, transform 0.2s, box-shadow 0.2s;
}

.grid-tile:hover:not(.grid-tile-active) {
  border-color: var(--border-default);
  background: var(--bg-hover);
  transform: translateY(-1px);
}

.grid-tile-active,
.grid-tile-active:hover {
  border-color: color-mix(in srgb, var(--accent-primary) 45%, var(--border-default));
  background: var(--accent-subtle);
  box-shadow: 0 6px 18px color-mix(in srgb, var(--accent-primary) 12%, transparent);
}

.grid-tile-main {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 8px 12px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: center;
}

.grid-tile-visual {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
}

.grid-tile-avatar {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.02em;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
}

.grid-tile-favorite {
  position: absolute;
  top: 0;
  right: 4px;
  display: inline-flex;
  color: #f59e0b;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.15));
}

.grid-tile-title {
  width: 100%;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.grid-tile-side {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 2;
}

.grid-tile-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: color-mix(in srgb, var(--bg-app) 72%, transparent);
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background-color 0.15s, color 0.15s;
}

.grid-tile:hover .grid-tile-menu-btn,
.grid-tile-active .grid-tile-menu-btn,
.grid-tile-side:focus-within .grid-tile-menu-btn {
  opacity: 1;
}

.grid-tile-menu-btn:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}

.grid-tile-side .action-menu {
  top: calc(100% + 4px);
  right: 0;
}

.list-panel--grid.list-panel--compact .entry-grid {
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 8px;
  padding: 12px 14px 16px;
}
</style>
