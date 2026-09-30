<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Search,
} from 'lucide-vue-next'
import { UiModal, UiButton, UiCard } from '@/components/ui'
import { useTheme } from '@/composables/useTheme'
import { useAppState } from '@/composables/useAppState'
import { countExportableForFormat } from '@/shared/exportParsers'
import type { PasswordEntry } from '@/shared/types'
import {
  EXPORT_DESTINATIONS,
  getExportDestination,
  isPwdBookExport,
  isThirdPartyCsvExport,
  type ExportDestinationId,
} from '@/shared/exportFormats'

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  exported: [formatId: ExportDestinationId]
}>()

const { t } = useI18n()
const { isAnimalIsland } = useTheme()
const { entries, exportData, exportDataAsExcel, exportDataAsCsv } = useAppState()

const EXPORT_MODAL_WIDTH = 760

type WizardStep = 'format' | 'entries' | 'confirm'

const step = ref<WizardStep>('format')
const selectedId = ref<ExportDestinationId | null>(null)
const selectedEntryIds = ref<string[]>([])
const entrySearch = ref('')
const exporting = ref(false)
const errorMessage = ref('')
const showPlainTextConfirm = ref(false)

const pwdbookDestinations = computed(() =>
  EXPORT_DESTINATIONS.filter((dest) => dest.group === 'pwdbook'),
)

const thirdPartyDestinations = computed(() =>
  EXPORT_DESTINATIONS.filter((dest) => dest.group === 'thirdParty'),
)

const selectedDestination = computed(() =>
  selectedId.value ? getExportDestination(selectedId.value) : undefined,
)

const showSelectionStep = computed(() => selectedId.value !== null && selectedId.value !== 'pwdbook-json')

const selectedEntries = computed(() => {
  const selected = new Set(selectedEntryIds.value)
  return entries.value.filter((entry) => selected.has(entry.id))
})

const filteredEntries = computed(() => {
  const query = entrySearch.value.trim().toLowerCase()
  if (!query) return entries.value
  return entries.value.filter((entry) =>
    [entry.title, entry.username, entry.url, entry.categoryName]
      .join(' ')
      .toLowerCase()
      .includes(query),
  )
})

const allEntriesSelected = computed(
  () => entries.value.length > 0 && selectedEntryIds.value.length === entries.value.length,
)

const stepLabels = computed(() =>
  showSelectionStep.value
    ? [t('export.steps.format'), t('export.steps.entries'), t('export.steps.confirm')]
    : [t('export.steps.format'), t('export.steps.confirm')],
)

const stepIndex = computed(() => {
  if (step.value === 'format') return 0
  if (step.value === 'entries') return showSelectionStep.value ? 1 : 0
  return showSelectionStep.value ? 2 : 1
})

const exportStats = computed(() => {
  if (!selectedId.value) return { total: 0, exportable: 0, skipped: 0 }
  const sourceEntries = showSelectionStep.value ? selectedEntries.value : entries.value
  return countExportableForFormat(selectedId.value, sourceEntries)
})

const canGoNext = computed(() => step.value === 'format' && selectedId.value !== null)

const canExport = computed(() => {
  if (step.value !== 'confirm' || !selectedId.value || exporting.value) return false
  if (showSelectionStep.value && selectedEntries.value.length === 0) return false
  if (isThirdPartyCsvExport(selectedId.value)) {
    return exportStats.value.exportable > 0
  }
  return exportStats.value.total > 0
})

const showPlainTextWarning = computed(() => {
  if (!selectedId.value) return false
  return selectedId.value !== 'pwdbook-json'
})

const showJsonHint = computed(() => selectedId.value === 'pwdbook-json')

const showExpectedColumns = computed(() => {
  const dest = selectedDestination.value
  return Boolean(dest && dest.expectedColumns.length > 0)
})

watch(open, (isOpen) => {
  if (!isOpen) resetState()
})

function resetState(): void {
  step.value = 'format'
  selectedId.value = null
  selectedEntryIds.value = []
  entrySearch.value = ''
  exporting.value = false
  errorMessage.value = ''
  showPlainTextConfirm.value = false
}

function close(): void {
  open.value = false
}

function pickFormat(id: ExportDestinationId): void {
  selectedId.value = id
  selectedEntryIds.value = []
  entrySearch.value = ''
  errorMessage.value = ''
}

function goBack(): void {
  if (step.value === 'confirm') {
    step.value = showSelectionStep.value ? 'entries' : 'format'
    errorMessage.value = ''
    return
  }
  if (step.value === 'entries') {
    step.value = 'format'
    errorMessage.value = ''
    return
  }
  close()
}

function goNext(): void {
  if (step.value === 'format' && canGoNext.value) {
    if (showSelectionStep.value) {
      selectedEntryIds.value = entries.value.map((entry) => entry.id)
      step.value = 'entries'
    } else {
      step.value = 'confirm'
    }
    errorMessage.value = ''
  } else if (step.value === 'entries' && selectedEntryIds.value.length > 0) {
    step.value = 'confirm'
    errorMessage.value = ''
  }
}

function isEntrySelected(id: string): boolean {
  return selectedEntryIds.value.includes(id)
}

function toggleEntry(id: string): void {
  selectedEntryIds.value = isEntrySelected(id)
    ? selectedEntryIds.value.filter((entryId) => entryId !== id)
    : [...selectedEntryIds.value, id]
}

function toggleAllEntries(): void {
  selectedEntryIds.value = allEntriesSelected.value ? [] : entries.value.map((entry) => entry.id)
}

function isEntryExportable(entry: PasswordEntry): boolean {
  if (!selectedId.value || !isThirdPartyCsvExport(selectedId.value)) return true
  return Boolean(entry.title?.trim() && entry.password)
}

function formatDisplayName(dest: (typeof EXPORT_DESTINATIONS)[number]): string {
  if (dest.group === 'thirdParty') {
    return t(`import.sources.${dest.nameKey}`)
  }
  return t(`export.formats.${dest.nameKey}`)
}

function formatDisplayDesc(dest: (typeof EXPORT_DESTINATIONS)[number]): string {
  if (dest.group === 'thirdParty') {
    return t(`export.formats.${dest.nameKey}`)
  }
  return t(`export.formats.${dest.descKey}`)
}

function downloadFilename(formatId: ExportDestinationId): string {
  const dest = getExportDestination(formatId)
  const ext = dest?.fileExt ?? 'bin'
  return `pwdbook-export-${formatId}-${Date.now()}.${ext}`
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function requestExport(): void {
  if (!canExport.value) return
  showPlainTextConfirm.value = true
}

function cancelPlainTextConfirm(): void {
  showPlainTextConfirm.value = false
}

async function confirmPlainTextExport(): Promise<void> {
  showPlainTextConfirm.value = false
  await executeExport()
}

async function executeExport(): Promise<void> {
  if (!selectedId.value || !canExport.value) return
  const formatId = selectedId.value
  const dest = getExportDestination(formatId)
  if (!dest) return

  exporting.value = true
  errorMessage.value = ''
  try {
    const filename = downloadFilename(formatId)

    if (formatId === 'pwdbook-json') {
      const json = await exportData()
      triggerDownload(new Blob([json], { type: dest.mimeType }), filename)
    } else if (formatId === 'pwdbook-xlsx') {
      const bytes = await exportDataAsExcel(selectedEntryIds.value)
      triggerDownload(new Blob([new Uint8Array(bytes)], { type: dest.mimeType }), filename)
    } else {
      const csv = await exportDataAsCsv(formatId, selectedEntryIds.value)
      triggerDownload(new Blob([csv], { type: dest.mimeType }), filename)
    }

    emit('exported', formatId)
    close()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('errors.export_failed')
  } finally {
    exporting.value = false
  }
}
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
    <div
      class="export-wizard"
      :class="{ 'export-wizard--animal': isAnimalIsland }"
    >
      <nav
        class="step-rail"
        aria-label="export steps"
      >
        <div
          v-for="(label, index) in stepLabels"
          :key="label"
          class="step-node"
          :class="{
            active: stepIndex === index,
            done: stepIndex > index,
          }"
        >
          <span class="step-dot">
            <Check
              v-if="stepIndex > index"
              :size="12"
              :stroke-width="2.5"
            />
            <span v-else>{{ index + 1 }}</span>
          </span>
          <span class="step-label">{{ label }}</span>
        </div>
      </nav>

      <section
        v-if="step === 'format'"
        class="step-panel"
      >
        <p class="step-lead">
          {{ t('export.lead') }}
        </p>

        <h4 class="group-title">
          {{ t('export.groups.pwdbook') }}
        </h4>
        <div class="format-grid">
          <button
            v-for="dest in pwdbookDestinations"
            :key="dest.id"
            type="button"
            class="format-card"
            :class="{ selected: selectedId === dest.id }"
            :style="{ '--format-accent': dest.accent }"
            @click="pickFormat(dest.id)"
          >
            <span
              class="format-monogram"
              aria-hidden="true"
            >{{ dest.monogram }}</span>
            <span class="format-text">
              <span class="format-name">{{ formatDisplayName(dest) }}</span>
              <span class="format-desc">{{ formatDisplayDesc(dest) }}</span>
            </span>
            <span
              v-if="selectedId === dest.id"
              class="format-check"
            >
              <Check
                :size="14"
                :stroke-width="2.5"
              />
            </span>
          </button>
        </div>

        <h4 class="group-title">
          {{ t('export.groups.thirdParty') }}
        </h4>
        <div class="format-grid">
          <button
            v-for="dest in thirdPartyDestinations"
            :key="dest.id"
            type="button"
            class="format-card"
            :class="{ selected: selectedId === dest.id }"
            :style="{ '--format-accent': dest.accent }"
            @click="pickFormat(dest.id)"
          >
            <span
              class="format-monogram"
              aria-hidden="true"
            >{{ dest.monogram }}</span>
            <span class="format-text">
              <span class="format-name">{{ formatDisplayName(dest) }}</span>
              <span class="format-desc">{{ formatDisplayDesc(dest) }}</span>
            </span>
            <span
              v-if="selectedId === dest.id"
              class="format-check"
            >
              <Check
                :size="14"
                :stroke-width="2.5"
              />
            </span>
          </button>
        </div>
      </section>

      <section
        v-else-if="step === 'entries'"
        class="step-panel entry-selection-panel"
      >
        <div class="selection-heading">
          <div>
            <h4>{{ t('export.selection.title') }}</h4>
            <p>{{ t('export.selection.lead') }}</p>
          </div>
          <span class="selection-count">
            {{ t('export.selection.selectedCount', { selected: selectedEntryIds.length, total: entries.length }) }}
          </span>
        </div>

        <div class="selection-toolbar">
          <label class="entry-search">
            <Search
              :size="15"
              :stroke-width="1.7"
            />
            <input
              v-model="entrySearch"
              type="search"
              :placeholder="t('export.selection.searchPlaceholder')"
            >
          </label>
          <UiButton
            variant="ghost"
            @click="toggleAllEntries"
          >
            {{ allEntriesSelected ? t('export.selection.clearAll') : t('export.selection.selectAll') }}
          </UiButton>
        </div>

        <div class="entry-table">
          <div class="entry-table-head">
            <span aria-hidden="true" />
            <span>{{ t('export.selection.entry') }}</span>
            <span>{{ t('export.selection.username') }}</span>
            <span>{{ t('export.selection.category') }}</span>
            <span>{{ t('export.selection.status') }}</span>
          </div>
          <div class="entry-table-body">
            <label
              v-for="entry in filteredEntries"
              :key="entry.id"
              class="entry-option"
              :class="{ selected: isEntrySelected(entry.id) }"
            >
              <input
                type="checkbox"
                :checked="isEntrySelected(entry.id)"
                @change="toggleEntry(entry.id)"
              >
              <span class="entry-primary">
                <strong>{{ entry.title || t('detail.untitled') }}</strong>
                <small>{{ entry.url || t('detail.noUrl') }}</small>
              </span>
              <span class="entry-cell entry-cell--muted">
                {{ entry.username || t('vault.noAccount') }}
              </span>
              <span class="entry-cell">{{ entry.categoryName }}</span>
              <span
                class="entry-status"
                :class="{ 'entry-status--warning': !isEntryExportable(entry) }"
              >
                {{ isEntryExportable(entry) ? t('export.selection.ready') : t('export.selection.willSkip') }}
              </span>
            </label>
            <p
              v-if="filteredEntries.length === 0"
              class="selection-empty"
            >
              {{ t('export.selection.noMatches') }}
            </p>
          </div>
        </div>
      </section>

      <section
        v-else-if="step === 'confirm'"
        class="step-panel step-panel--confirm"
      >
        <div
          v-if="selectedDestination"
          class="format-banner"
        >
          <span
            class="banner-monogram"
            :style="{
              background: `color-mix(in srgb, ${selectedDestination.accent} 14%, var(--bg-surface))`,
              color: selectedDestination.accent,
            }"
          >
            {{ selectedDestination.monogram }}
          </span>
          <div>
            <p class="banner-title">
              {{ formatDisplayName(selectedDestination) }}
            </p>
            <p class="banner-sub">
              {{ formatDisplayDesc(selectedDestination) }}
            </p>
          </div>
        </div>

        <UiCard class="summary-card">
          <p
            v-if="selectedId && isPwdBookExport(selectedId)"
            class="summary-line"
          >
            {{ t('export.summary.allEntries', { count: exportStats.total }) }}
          </p>
          <template v-else-if="selectedId && isThirdPartyCsvExport(selectedId)">
            <p class="summary-line">
              {{
                t('export.summary.thirdPartyExportable', {
                  count: exportStats.exportable,
                })
              }}
            </p>
            <p
              v-if="exportStats.skipped > 0"
              class="summary-line summary-line--muted"
            >
              {{
                t('export.summary.thirdPartySkipped', {
                  count: exportStats.skipped,
                })
              }}
            </p>
            <p
              v-if="exportStats.exportable === 0"
              class="summary-line summary-line--warn"
            >
              {{ t('export.summary.noExportable') }}
            </p>
          </template>
        </UiCard>

        <p
          v-if="showJsonHint"
          class="security-hint"
        >
          {{ t('export.security.jsonHint') }}
        </p>
        <p
          v-if="showPlainTextWarning"
          class="security-warning"
        >
          {{ t('export.plainTextWarning') }}
        </p>

        <template v-if="selectedDestination?.importGuideKey">
          <p class="import-guide-label">
            {{ t('export.importGuideLabel') }}
          </p>
          <UiCard class="guide-card">
            <p>{{ t(`export.importGuide.${selectedDestination.importGuideKey}`) }}</p>
          </UiCard>
        </template>

        <div
          v-if="showExpectedColumns && selectedDestination"
          class="columns-section"
        >
          <p class="columns-label">
            {{ t('import.expectedColumns') }}
          </p>
          <div class="header-chips">
            <code
              v-for="col in selectedDestination.expectedColumns"
              :key="col"
            >{{ col }}</code>
          </div>
        </div>

        <p
          v-if="errorMessage"
          class="inline-error"
        >
          <AlertCircle
            :size="14"
            :stroke-width="1.5"
          />
          {{ errorMessage }}
        </p>
      </section>

      <footer class="wizard-footer">
        <UiButton
          variant="ghost"
          @click="goBack"
        >
          <ArrowLeft
            :size="16"
            :stroke-width="1.5"
          />
          {{ step === 'format' ? t('common.cancel') : t('common.back') }}
        </UiButton>
        <div class="footer-actions">
          <UiButton
            v-if="step !== 'confirm'"
            variant="primary"
            :disabled="step === 'format' ? !canGoNext : selectedEntryIds.length === 0"
            @click="goNext"
          >
            {{ t('common.next') }}
            <ArrowRight
              :size="16"
              :stroke-width="1.5"
            />
          </UiButton>
          <UiButton
            v-else
            variant="primary"
            :disabled="!canExport"
            :loading="exporting"
            @click="requestExport"
          >
            <Download
              :size="16"
              :stroke-width="1.5"
            />
            {{ t('export.confirmExport') }}
          </UiButton>
        </div>
      </footer>
    </div>
  </UiModal>

  <UiModal
    v-model:open="showPlainTextConfirm"
    :title="t('export.plainTextConfirmTitle')"
    :width="400"
    :show-footer="false"
    @close="cancelPlainTextConfirm"
  >
    <p class="confirm-modal-body plain-text-confirm-text">
      <AlertCircle
        :size="16"
        :stroke-width="1.5"
        class="plain-text-confirm-icon"
      />
      {{ t('export.plainTextConfirmBody') }}
    </p>
    <template #footer>
      <div class="confirm-modal-actions">
        <UiButton
          variant="default"
          @click="cancelPlainTextConfirm"
        >
          {{ t('common.cancel') }}
        </UiButton>
        <UiButton
          variant="primary"
          :loading="exporting"
          @click="confirmPlainTextExport"
        >
          <Download
            :size="16"
            :stroke-width="1.5"
          />
          {{ t('export.confirmExport') }}
        </UiButton>
      </div>
    </template>
  </UiModal>
</template>

<style scoped>
.export-wizard {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
}

.export-wizard--animal {
  gap: 12px;
}

.step-rail {
  display: flex;
  gap: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-default);
}

.step-node {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  opacity: 0.45;
  transition: opacity 0.2s;
}

.step-node.active,
.step-node.done {
  opacity: 1;
}

.step-dot {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  color: var(--text-muted);
}

.step-node.active .step-dot {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: var(--btn-primary-text);
}

.step-node.done .step-dot {
  background: var(--accent-subtle);
  border-color: var(--border-accent);
  color: var(--accent-primary);
}

.step-label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.step-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-lead {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.group-title {
  margin: 8px 0 0;
  padding-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-default);
}

.format-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 640px) {
  .format-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
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
    box-shadow 0.2s,
    transform 0.15s;
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

.entry-selection-panel {
  min-height: 0;
}

.selection-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.selection-heading h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
}

.selection-heading p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.selection-count {
  flex-shrink: 0;
  padding: 5px 9px;
  border-radius: 999px;
  background: var(--accent-subtle);
  color: var(--accent-primary);
  font-size: 11px;
  font-weight: 600;
}

.selection-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.entry-search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  color: var(--text-muted);
}

.entry-search:focus-within {
  border-color: var(--border-accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-primary) 14%, transparent);
}

.entry-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  font-size: 12px;
}

.entry-table {
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
}

.entry-table-head,
.entry-option {
  display: grid;
  grid-template-columns: 24px minmax(180px, 1.6fr) minmax(100px, 1fr) minmax(90px, 0.8fr) minmax(66px, auto);
  align-items: center;
  gap: 10px;
}

.entry-table-head {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-default);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.entry-table-body {
  max-height: 280px;
  overflow-y: auto;
}

.entry-option {
  padding: 10px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--border-default) 70%, transparent);
  cursor: pointer;
  transition: background 0.15s;
}

.entry-option:last-child {
  border-bottom: 0;
}

.entry-option:hover,
.entry-option.selected {
  background: var(--bg-hover);
}

.entry-option input {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: var(--accent-primary);
}

.entry-primary,
.entry-cell {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-primary {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.entry-primary strong {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  font-weight: 600;
}

.entry-primary small {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 10px;
  text-overflow: ellipsis;
}

.entry-cell {
  color: var(--text-secondary);
  font-size: 11px;
}

.entry-cell--muted {
  color: var(--text-muted);
}

.entry-status {
  color: var(--status-success, var(--accent-primary));
  font-size: 10px;
  font-weight: 600;
  text-align: right;
}

.entry-status--warning {
  color: var(--status-warning, var(--status-danger));
}

.selection-empty {
  margin: 0;
  padding: 28px 16px;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}

.step-panel--confirm {
  gap: 10px;
}

@media (max-width: 640px) {
  .selection-heading {
    flex-direction: column;
    gap: 8px;
  }

  .entry-table-head,
  .entry-option {
    grid-template-columns: 24px minmax(150px, 1fr) minmax(90px, 0.75fr) minmax(58px, auto);
  }

  .entry-table-head span:nth-child(4),
  .entry-option .entry-cell:nth-of-type(3) {
    display: none;
  }

  .entry-table-head span:last-child {
    grid-column: 4;
  }
}

.format-banner {
  display: flex;
  align-items: center;
  gap: 12px;
}

.banner-monogram {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  font-family: var(--font-mono);
  flex-shrink: 0;
}

.banner-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.banner-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.summary-card {
  padding: 12px 14px;
}

.summary-line {
  margin: 0;
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
}

.summary-line + .summary-line {
  margin-top: 6px;
}

.summary-line--muted {
  color: var(--text-secondary);
  font-size: 12px;
}

.summary-line--warn {
  color: var(--status-danger);
  font-size: 12px;
}

.security-hint {
  margin: 0;
  font-size: 12px;
  color: var(--accent-primary);
  line-height: 1.45;
}

.security-warning {
  margin: 0;
  font-size: 12px;
  color: var(--status-danger);
  line-height: 1.45;
}

.import-guide-label {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.guide-card {
  padding: 12px 14px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.guide-card p {
  margin: 0;
}

.columns-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.columns-label {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
}

.header-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 120px;
  overflow-y: auto;
}

.header-chips code {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg-hover);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
}

.inline-error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 12px;
  color: var(--status-danger);
}

.wizard-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid var(--border-default);
}

.footer-actions {
  display: flex;
  gap: 8px;
}

.confirm-modal-body {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}

.plain-text-confirm-text {
  color: var(--text-secondary);
}

.plain-text-confirm-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--status-danger);
}

.confirm-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}
</style>

<style>
.modal-overlay:has(.export-wizard) .modal-card {
  width: min(760px, calc(100vw - 48px));
  max-width: min(760px, calc(100vw - 48px));
}

[data-skin='animalIsland'] .animal-modal:has(.export-wizard),
[data-skin='animalIsland'] .export-data-modal {
  width: 760px !important;
  max-width: min(760px, calc(100vw - 32px)) !important;
}
</style>
