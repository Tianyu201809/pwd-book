<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Trash2, RotateCcw, Undo2 } from 'lucide-vue-next'
import CategoryIconView from '@/components/CategoryIconView.vue'
import { UiButton } from '@/components/ui'
import { useAppState } from '@/composables/useAppState'
import { getAvatarMeta } from '@/shared/utils'
import type { TrashedEntry } from '@/types'

const {
  navigateTo,
  trashEntries,
  securitySettings,
  restoreTrashEntry,
  restoreAllTrash,
  permanentlyDeleteTrash,
  emptyTrash,
} = useAppState()

const { t, locale } = useI18n()

const retentionDays = computed(() => securitySettings.value.trashRetentionDays)

function formatDeletedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleString(
    locale.value === 'zh-CN' ? 'zh-CN' : 'en-US',
    { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
  )
}

function goBack(): void {
  navigateTo('vault')
}

async function handleRestore(entry: TrashedEntry): Promise<void> {
  await restoreTrashEntry(entry.id)
}

async function handleRestoreAll(): Promise<void> {
  if (trashEntries.value.length === 0) return
  if (!window.confirm(t('trash.restoreAllConfirm', { count: trashEntries.value.length }))) return
  await restoreAllTrash()
}

async function handlePermanentDelete(entry: TrashedEntry): Promise<void> {
  if (!window.confirm(t('trash.deletePermanentConfirm', { title: entry.title }))) return
  await permanentlyDeleteTrash(entry.id)
}

async function handleEmptyTrash(): Promise<void> {
  if (trashEntries.value.length === 0) return
  if (!window.confirm(t('trash.emptyConfirm', { count: trashEntries.value.length }))) return
  await emptyTrash()
}
</script>

<template>
  <div class="tool-page-view">
    <div class="tool-page-body">
      <aside class="tool-page-sidebar">
        <button type="button" class="tool-back-btn" @click="goBack">
          <ArrowLeft :size="16" :stroke-width="1.5" />
          {{ t('trash.backToVault') }}
        </button>
        <div class="tool-sidebar-hero">
          <div class="tool-hero-icon tool-hero-icon--trash">
            <Trash2 :size="24" :stroke-width="1.5" />
          </div>
          <h2 class="tool-sidebar-title font-display">{{ t('trash.title') }}</h2>
          <p class="tool-sidebar-desc">
            {{ t('trash.subtitle', { days: retentionDays }) }}
          </p>
        </div>
      </aside>

      <main class="tool-page-main">
        <div class="tool-page-content">
          <section class="panel-glow surface-card trash-panel">
            <div class="trash-toolbar">
              <p class="trash-summary">
                {{ t('trash.itemCount', { count: trashEntries.length }) }}
              </p>
              <div class="trash-actions">
                <UiButton
                  variant="ghost"
                  :disabled="trashEntries.length === 0"
                  @click="handleRestoreAll"
                >
                  <template #icon><Undo2 :size="16" :stroke-width="1.5" /></template>
                  {{ t('trash.restoreAll') }}
                </UiButton>
                <UiButton
                  variant="ghost"
                  class="trash-empty-btn"
                  :disabled="trashEntries.length === 0"
                  @click="handleEmptyTrash"
                >
                  <template #icon><Trash2 :size="16" :stroke-width="1.5" /></template>
                  {{ t('trash.emptyTrash') }}
                </UiButton>
              </div>
            </div>

            <div v-if="trashEntries.length === 0" class="trash-empty">
              <p>{{ t('trash.empty') }}</p>
            </div>

            <ul v-else class="trash-list">
              <li v-for="entry in trashEntries" :key="entry.id" class="trash-item">
                <div class="trash-item-main">
                  <CategoryIconView
                    v-if="entry.displayIcon"
                    :name="entry.displayIcon"
                    :badge-size="36"
                    :size="16"
                  />
                  <div
                    v-else
                    class="trash-avatar"
                    :style="{ background: getAvatarMeta(entry.title).color }"
                  >
                    {{ getAvatarMeta(entry.title).text }}
                  </div>
                  <div class="trash-meta">
                    <p class="trash-item-title">{{ entry.title }}</p>
                    <p class="trash-item-sub">
                      {{ entry.username || entry.url || t('vault.noAccount') }}
                      <template v-if="entry.categoryName"> · {{ entry.categoryName }}</template>
                    </p>
                    <p class="trash-item-time">
                      {{ t('trash.deletedAt', { date: formatDeletedAt(entry.deletedAt) }) }}
                      ·
                      {{ t('trash.expiresIn', { days: entry.daysRemaining }) }}
                    </p>
                  </div>
                </div>
                <div class="trash-item-actions">
                  <button type="button" class="trash-action-btn" @click="handleRestore(entry)">
                    <RotateCcw :size="14" :stroke-width="1.5" />
                    {{ t('trash.restore') }}
                  </button>
                  <button
                    type="button"
                    class="trash-action-btn trash-action-btn--danger"
                    @click="handlePermanentDelete(entry)"
                  >
                    <Trash2 :size="14" :stroke-width="1.5" />
                    {{ t('trash.deletePermanent') }}
                  </button>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.trash-panel {
  padding: 20px 24px;
}

.trash-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.trash-summary {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.trash-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.trash-empty-btn {
  color: var(--status-danger);
}

.trash-empty {
  padding: 48px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}

.trash-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.trash-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid var(--border-default);
}

.trash-item:last-child {
  border-bottom: none;
}

.trash-item-main {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  flex: 1;
}

.trash-avatar {
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

.trash-meta {
  min-width: 0;
  flex: 1;
}

.trash-item-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trash-item-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trash-item-time {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--text-muted);
}

.trash-item-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.trash-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: none;
  border-radius: 8px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.trash-action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.trash-action-btn--danger:hover {
  color: var(--status-danger);
}

.tool-hero-icon--trash {
  background: var(--accent-subtle);
  color: var(--accent-primary);
}
</style>
