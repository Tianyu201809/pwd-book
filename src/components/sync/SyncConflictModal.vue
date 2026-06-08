<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { AlertTriangle } from 'lucide-vue-next'
import { UiModal, UiButton } from '@/components/ui'
import type { SyncConflict } from '@/shared/syncTypes'

const props = defineProps<{
  open: boolean
  conflicts: SyncConflict[]
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

const conflictItems = computed(() =>
  props.conflicts.map((item) => ({
    ...item,
    timeText: new Date(item.localUpdatedAt).toLocaleString(),
  })),
)
</script>

<template>
  <UiModal
    :open="open"
    :title="t('tools.wifiSync.conflictTitle')"
    @close="emit('close')"
  >
    <div class="conflict-body">
      <p class="conflict-desc">{{ t('tools.wifiSync.conflictDesc', { count: conflicts.length }) }}</p>
      <ul class="conflict-list">
        <li v-for="item in conflictItems" :key="item.entryId" class="conflict-item">
          <AlertTriangle :size="16" :stroke-width="1.5" class="conflict-icon" />
          <div>
            <p class="conflict-title">{{ item.title || item.entryId }}</p>
            <p class="conflict-meta">{{ t('tools.wifiSync.conflictKeptLocal', { time: item.timeText }) }}</p>
          </div>
        </li>
      </ul>
    </div>
    <template #footer>
      <UiButton variant="primary" @click="emit('close')">{{ t('common.confirm') }}</UiButton>
    </template>
  </UiModal>
</template>

<style scoped>
.conflict-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.conflict-desc {
  margin: 0;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.5;
}

.conflict-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 280px;
  overflow-y: auto;
}

.conflict-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 12px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md, 8px);
  background: var(--bg-elevated);
}

.conflict-icon {
  flex-shrink: 0;
  color: var(--status-warning, #ca8a04);
  margin-top: 2px;
}

.conflict-title {
  margin: 0;
  font-weight: 600;
  color: var(--text-primary);
}

.conflict-meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
