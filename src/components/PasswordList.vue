<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, SlidersHorizontal, MoreHorizontal, Check } from 'lucide-vue-next'
import CategoryIconView from '@/components/CategoryIconView.vue'
import EntryListMenu from '@/components/EntryListMenu.vue'
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
} = useAppState()

const { t } = useI18n()

const sortOptions = computed(() => [
  { id: 'recent' as ListSortOrder, label: t('vault.sortRecent') },
  { id: 'title' as ListSortOrder, label: t('vault.sortTitle') },
  { id: 'created' as ListSortOrder, label: t('vault.sortCreated') },
])

const openMenuId = ref<string | null>(null)
const showSortMenu = ref(false)
const contextMenu = ref<{ entry: PasswordEntry; x: number; y: number } | null>(null)

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

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
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
}
</script>

<template>
  <main class="list-panel">
    <div class="list-toolbar">
      <div class="search-wrap">
        <Search class="search-icon" :size="16" :stroke-width="1.5" />
        <input
          v-model="searchQuery"
          type="text"
          class="input-field search-input"
          :placeholder="t('vault.searchPlaceholder')"
          @input="touchActivity"
        />
      </div>
      <div class="sort-menu-wrap">
        <button
          type="button"
          class="filter-btn btn-ghost"
          :class="{ active: showSortMenu }"
          :title="t('vault.sortBy')"
          :aria-label="t('vault.sortBy')"
          @click="toggleSortMenu"
        >
          <SlidersHorizontal :size="16" :stroke-width="1.5" />
        </button>
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

    <div class="list-scroll">
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
              <span v-if="entry.isFavorite" class="tag favorite">{{ t('common.favorite') }}</span>
              <span v-else-if="entry.tags[0]" class="tag">{{ entry.tags[0] }}</span>
              <span v-else-if="entry.categoryName" class="tag category">{{ entry.categoryName }}</span>
            </div>
            <p class="username">{{ entry.username || entry.url || t('vault.noAccount') }}</p>
          </div>
        </button>

        <div class="list-item-side">
          <span class="time">{{ entry.lastUsedLabel }}</span>
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
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-app);
}

.list-toolbar {
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
  flex: 1;
  overflow-y: auto;
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
  flex: 1;
  min-width: 0;
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
  flex-shrink: 0;
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
}

.entry-title {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--accent-subtle);
  color: var(--accent-primary);
  font-weight: 500;
}

.tag.favorite {
  background: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.username {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
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
