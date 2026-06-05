<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowLeft, Trash2, RotateCcw, Undo2 } from 'lucide-vue-next'
import CategoryIconView from '@/components/CategoryIconView.vue'
import { UiButton, UiModal } from '@/components/ui'
import { useAppState } from '@/composables/useAppState'
import { getAvatarMeta } from '@/shared/utils'
import type { TrashedEntry } from '@/types'

type TrashConfirmAction = 'restoreAll' | 'deletePermanent' | 'empty'

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

const confirmAction = ref<TrashConfirmAction | null>(null)
const confirmEntry = ref<TrashedEntry | null>(null)
const showConfirm = computed({
  get: () => confirmAction.value !== null,
  set: (open: boolean) => {
    if (!open) cancelConfirm()
  },
})

const confirmTitle = computed(() => {
  switch (confirmAction.value) {
    case 'restoreAll':
      return t('trash.restoreAll')
    case 'deletePermanent':
      return t('trash.deletePermanent')
    case 'empty':
      return t('trash.emptyTrash')
    default:
      return ''
  }
})

const confirmMessage = computed(() => {
  switch (confirmAction.value) {
    case 'restoreAll':
      return t('trash.restoreAllConfirm', { count: trashEntries.value.length })
    case 'deletePermanent':
      return t('trash.deletePermanentConfirm', { title: confirmEntry.value?.title ?? '' })
    case 'empty':
      return t('trash.emptyConfirm', { count: trashEntries.value.length })
    default:
      return ''
  }
})

const confirmIsDestructive = computed(
  () => confirmAction.value === 'deletePermanent' || confirmAction.value === 'empty',
)

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

function openConfirm(action: TrashConfirmAction, entry?: TrashedEntry): void {
  confirmAction.value = action
  confirmEntry.value = entry ?? null
}

function cancelConfirm(): void {
  confirmAction.value = null
  confirmEntry.value = null
}

async function handleConfirm(): Promise<void> {
  const action = confirmAction.value
  const entry = confirmEntry.value
  cancelConfirm()
  if (!action) return
  switch (action) {
    case 'restoreAll':
      await restoreAllTrash()
      break
    case 'deletePermanent':
      if (entry) await permanentlyDeleteTrash(entry.id)
      break
    case 'empty':
      await emptyTrash()
      break
  }
}

function handleRestoreAll(): void {
  if (trashEntries.value.length === 0) return
  openConfirm('restoreAll')
}

function handlePermanentDelete(entry: TrashedEntry): void {
  openConfirm('deletePermanent', entry)
}

function handleEmptyTrash(): void {
  if (trashEntries.value.length === 0) return
  openConfirm('empty')
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

    <UiModal
      v-model:open="showConfirm"
      :title="confirmTitle"
      :width="400"
      :show-footer="false"
      @close="cancelConfirm"
    >
      <p class="confirm-modal-body delete-confirm-text">
        {{ confirmMessage }}
      </p>
      <template #footer>
        <div class="confirm-modal-actions">
          <UiButton variant="default" @click="cancelConfirm">{{ t('common.cancel') }}</UiButton>
          <UiButton
            :variant="confirmIsDestructive ? 'danger' : 'primary'"
            @click="handleConfirm"
          >
            {{ t('common.confirm') }}
          </UiButton>
        </div>
      </template>
    </UiModal>
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
</style>
