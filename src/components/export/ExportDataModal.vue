<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Download } from 'lucide-vue-next'
import { UiModal, UiButton } from '@/components/ui'
import { useTheme } from '@/composables/useTheme'
import { useAppState } from '@/composables/useAppState'
import { EXPORT_FORMATS, type ExportFormatId } from '@/shared/exportFormats'

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  exported: [formatId: ExportFormatId]
}>()

const { t } = useI18n()
const { isAnimalIsland } = useTheme()
const { exportDataAsCsv } = useAppState()

const EXPORT_MODAL_WIDTH = 760

const selectedId = ref<ExportFormatId | null>(null)
const exporting = ref(false)
const errorMessage = ref('')

function resetState(): void {
  selectedId.value = null
  exporting.value = false
  errorMessage.value = ''
}

function close(): void {
  open.value = false
}

function pickFormat(id: ExportFormatId): void {
  selectedId.value = id
  errorMessage.value = ''
}

function downloadFilename(formatId: ExportFormatId): string {
  return `pwdbook-export-${formatId}-${Date.now()}.csv`
}

async function handleExport(): Promise<void> {
  if (!selectedId.value) return
  exporting.value = true
  errorMessage.value = ''
  try {
    const csv = await exportDataAsCsv(selectedId.value)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = downloadFilename(selectedId.value)
    anchor.click()
    URL.revokeObjectURL(url)
    emit('exported', selectedId.value)
    close()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('errors.export_failed')
  } finally {
    exporting.value = false
  }
}

watch(open, (isOpen) => {
  if (!isOpen) resetState()
})
</script>

<template>
  <UiModal
    v-model:open="open"
    class="export-data-modal"
    :title="t('export.title')"
    :width="EXPORT_MODAL_WIDTH"
    :show-footer="false"
    @close="close"
  >
    <div class="export-panel" :class="{ 'export-panel--animal': isAnimalIsland }">
      <p class="export-lead">{{ t('export.lead') }}</p>
      <p class="export-warning">{{ t('export.plainTextWarning') }}</p>

      <div class="format-grid">
        <button
          v-for="format in EXPORT_FORMATS"
          :key="format.id"
          type="button"
          class="format-card"
          :class="{ selected: selectedId === format.id }"
          :style="{ '--format-accent': format.accent }"
          @click="pickFormat(format.id)"
        >
          <span class="format-monogram" aria-hidden="true">{{ format.monogram }}</span>
          <span class="format-text">
            <span class="format-name">{{ t(`import.sources.${format.nameKey}`) }}</span>
            <span class="format-desc">{{ t(`export.formats.${format.nameKey}`) }}</span>
          </span>
          <span v-if="selectedId === format.id" class="format-check">
            <Check :size="14" :stroke-width="2.5" />
          </span>
        </button>
      </div>

      <p v-if="errorMessage" class="export-error">{{ errorMessage }}</p>

      <footer class="export-footer">
        <UiButton variant="ghost" @click="close">{{ t('common.cancel') }}</UiButton>
        <UiButton
          variant="primary"
          :disabled="!selectedId"
          :loading="exporting"
          @click="handleExport"
        >
          <Download :size="16" :stroke-width="1.5" />
          {{ t('export.downloadCsv') }}
        </UiButton>
      </footer>
    </div>
  </UiModal>
</template>

<style scoped>
.export-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.export-lead {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.export-warning {
  margin: 0;
  font-size: 12px;
  color: var(--status-danger);
  line-height: 1.45;
}

.format-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.format-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 18px;
  text-align: left;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  cursor: pointer;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.format-card:hover {
  border-color: var(--border-strong);
  background: var(--bg-hover);
}

.format-card.selected {
  border-color: var(--format-accent, var(--accent-primary));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--format-accent, var(--accent-primary)) 35%, transparent);
}

.format-monogram {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font-mono);
  flex-shrink: 0;
  background: color-mix(in srgb, var(--format-accent) 18%, var(--bg-surface));
  color: var(--format-accent);
}

.format-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.format-name {
  font-size: 14px;
  font-weight: 600;
}

.format-desc {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.35;
}

.format-check {
  position: absolute;
  top: 10px;
  right: 10px;
  color: var(--format-accent, var(--accent-primary));
}

.export-error {
  margin: 0;
  font-size: 12px;
  color: var(--status-danger);
}

.export-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-default);
}

.export-panel--animal {
  gap: 12px;
}
</style>

<style>
.modal-overlay:has(.export-panel) .modal-card {
  width: min(760px, calc(100vw - 48px));
  max-width: min(760px, calc(100vw - 48px));
}

[data-skin='animalIsland'] .animal-modal:has(.export-panel),
[data-skin='animalIsland'] .export-data-modal {
  width: 760px !important;
  max-width: min(760px, calc(100vw - 32px)) !important;
}
</style>
