<script setup lang="ts">
import { computed, ref } from 'vue'
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
let moveSubmenuCloseTimer: ReturnType<typeof setTimeout> | null = null

function openMoveSubmenu(): void {
  if (moveSubmenuCloseTimer) {
    clearTimeout(moveSubmenuCloseTimer)
    moveSubmenuCloseTimer = null
  }
  moveSubmenuOpen.value = true
}

function scheduleCloseMoveSubmenu(): void {
  if (moveSubmenuCloseTimer) clearTimeout(moveSubmenuCloseTimer)
  moveSubmenuCloseTimer = setTimeout(() => {
    moveSubmenuOpen.value = false
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

  <div
    class="menu-item-submenu"
    @click.stop
    @mouseenter="openMoveSubmenu"
    @mouseleave="scheduleCloseMoveSubmenu"
  >
    <button type="button" class="action-menu-item submenu-trigger">
      <span>{{ t('vault.moveTo') }}</span>
      <ChevronRight :size="14" :stroke-width="2" class="submenu-chevron" />
    </button>
    <div class="submenu surface-card" :class="{ open: moveSubmenuOpen }">
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
  position: absolute;
  left: calc(100% + 4px);
  top: 0;
  min-width: 168px;
  max-width: 220px;
  max-height: 280px;
  overflow-y: auto;
  padding: 4px;
  z-index: 120;
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
