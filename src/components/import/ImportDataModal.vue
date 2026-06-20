<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Upload,
  AlertCircle,
  HelpCircle,
  X,
} from 'lucide-vue-next'
import { UiModal, UiButton, UiCard, UiLoading } from '@/components/ui'
import { useTheme } from '@/composables/useTheme'
import { useAppState } from '@/composables/useAppState'
import type { ImportPreviewItem, ImportPreviewResult } from '@/shared/types'
import {
  IMPORT_SOURCES,
  getImportSource,
  isPwdbookNativeImport,
  type ImportSourceId,
  type ImportSourceMeta,
} from '@/shared/importSources'

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  imported: [count: number]
}>()

const { t } = useI18n()
const { isAnimalIsland } = useTheme()
const { previewImportData, commitImportData } = useAppState()

/** 导入向导统一宽度（经典 / 动森） */
const IMPORT_MODAL_WIDTH = 760

type WizardStep = 'source' | 'file' | 'review'
type ReviewTab = 'ready' | 'skipped' | 'invalid'

const step = ref<WizardStep>('source')
const selectedId = ref<ImportSourceId | null>(null)
const selectedFile = ref<File | null>(null)
const csvHeaders = ref<string[]>([])
const csvRowCount = ref(0)
const parseError = ref('')
const guideExpanded = ref(false)
const isDragging = ref(false)
const previewLoading = ref(false)
const committing = ref(false)
const previewResult = ref<ImportPreviewResult | null>(null)
const reviewTab = ref<ReviewTab>('ready')

const selectedSource = computed(() =>
  selectedId.value ? getImportSource(selectedId.value) : undefined,
)

const isJsonSource = computed(() => selectedId.value === 'pwdbook-json')
const isPwdbookNativeSource = computed(() =>
  selectedId.value ? isPwdbookNativeImport(selectedId.value) : false,
)

const stepIndex = computed(() => {
  if (step.value === 'source') return 0
  if (step.value === 'file') return 1
  return 2
})

const canGoNext = computed(() => {
  if (step.value === 'source') return selectedId.value !== null
  if (step.value === 'file') return selectedFile.value !== null && !parseError.value
  return false
})

const canImport = computed(
  () => step.value === 'review' && (previewResult.value?.totals.ready ?? 0) > 0 && !committing.value,
)

const reviewList = computed((): ImportPreviewItem[] => {
  if (!previewResult.value) return []
  if (reviewTab.value === 'ready') return previewResult.value.ready
  if (reviewTab.value === 'skipped') return previewResult.value.skipped
  return previewResult.value.invalid
})

const reviewTabs = computed(() => [
  { id: 'ready' as const, label: t('import.tabReady', { n: previewResult.value?.totals.ready ?? 0 }) },
  {
    id: 'skipped' as const,
    label: t('import.tabSkipped', { n: previewResult.value?.totals.skipped ?? 0 }),
  },
  {
    id: 'invalid' as const,
    label: t('import.tabInvalid', { n: previewResult.value?.totals.invalid ?? 0 }),
  },
])

watch(open, (isOpen) => {
  if (!isOpen) resetWizard()
})

function resetWizard(): void {
  step.value = 'source'
  selectedId.value = null
  selectedFile.value = null
  csvHeaders.value = []
  csvRowCount.value = 0
  parseError.value = ''
  guideExpanded.value = false
  isDragging.value = false
  previewLoading.value = false
  committing.value = false
  previewResult.value = null
  reviewTab.value = 'ready'
}

function close(): void {
  open.value = false
}

function pickSource(id: ImportSourceId): void {
  selectedId.value = id
  selectedFile.value = null
  csvHeaders.value = []
  csvRowCount.value = 0
  parseError.value = ''
  guideExpanded.value = false
}

function goBack(): void {
  if (step.value === 'review') {
    step.value = 'file'
    previewResult.value = null
    return
  }
  if (step.value === 'file') {
    step.value = 'source'
    return
  }
  close()
}

function goNext(): void {
  if (step.value === 'source' && canGoNext.value) {
    step.value = 'file'
    return
  }
  if (step.value === 'file' && canGoNext.value) {
    void runPreview()
  }
}

async function runPreview(): Promise<void> {
  if (!selectedFile.value || !selectedId.value) return
  previewLoading.value = true
  parseError.value = ''
  try {
    const content = await selectedFile.value.text()
    previewResult.value = await previewImportData(selectedId.value, content)
    reviewTab.value = previewResult.value.ready.length > 0 ? 'ready' : 'skipped'
    step.value = 'review'
  } catch (error) {
    parseError.value = error instanceof Error ? error.message : t('import.errors.previewFailed')
  } finally {
    previewLoading.value = false
  }
}

function removeReadyItem(index: number): void {
  const result = previewResult.value
  if (!result || reviewTab.value !== 'ready') return
  const nextReady = [...result.ready]
  nextReady.splice(index, 1)
  previewResult.value = {
    ...result,
    ready: nextReady,
    totals: { ...result.totals, ready: nextReady.length },
  }
}

function reasonLabel(item: ImportPreviewItem): string {
  if (item.reason === 'duplicate_vault') {
    return t('import.reasonDuplicateVault', { title: item.matchTitle ?? item.title })
  }
  if (item.reason === 'duplicate_file') return t('import.reasonDuplicateFile')
  if (item.reason === 'missing_password') return t('import.reasonMissingPassword')
  return t('import.reasonMissingTitle')
}

/** 简易 CSV 首行解析（仅用于预览，非完整 RFC 4180） */
function parseCsvPreviewLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current.trim())
  return cells
}

async function ingestFile(file: File, source: ImportSourceMeta): Promise<void> {
  selectedFile.value = file
  parseError.value = ''
  csvHeaders.value = []
  csvRowCount.value = 0

  if (source.id === 'pwdbook-json') {
    if (!file.name.toLowerCase().endsWith('.json')) {
      parseError.value = t('import.errors.jsonOnly')
      return
    }
    return
  }

  if (!file.name.toLowerCase().endsWith('.csv')) {
    parseError.value = t('import.errors.csvOnly')
    return
  }

  const text = await file.text()
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) {
    parseError.value = t('import.errors.emptyFile')
    return
  }
  csvHeaders.value = parseCsvPreviewLine(lines[0])
  csvRowCount.value = Math.max(0, lines.length - 1)
  if (csvHeaders.value.length === 0) {
    parseError.value = t('import.errors.noHeaders')
  }
}

async function onFileInput(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const source = selectedSource.value
  if (!file || !source) return
  await ingestFile(file, source)
  input.value = ''
}

async function onDrop(event: DragEvent): Promise<void> {
  event.preventDefault()
  isDragging.value = false
  const source = selectedSource.value
  const file = event.dataTransfer?.files?.[0]
  if (!file || !source) return
  await ingestFile(file, source)
}

function openFilePicker(): void {
  const source = selectedSource.value
  if (!source) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = source.accept
  input.onchange = (e) => void onFileInput(e)
  input.click()
}

async function handleImport(): Promise<void> {
  if (!selectedId.value || !previewResult.value || previewResult.value.totals.ready === 0) return
  committing.value = true
  parseError.value = ''
  try {
    const entries = previewResult.value.ready
      .map((item) => item.entry)
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    const count = await commitImportData(
      selectedId.value,
      entries,
      previewResult.value.categories,
      previewResult.value.attachments,
    )
    emit('imported', count)
    close()
  } catch (error) {
    parseError.value = error instanceof Error ? error.message : t('import.errors.previewFailed')
  } finally {
    committing.value = false
  }
}

const stepLabels = computed(() => [
  t('import.steps.source'),
  t('import.steps.file'),
  t('import.steps.review'),
])
</script>

<template>
  <UiModal
    v-model:open="open"
    class="import-data-modal"
    :title="t('import.title')"
    :width="IMPORT_MODAL_WIDTH"
    :show-footer="false"
    @close="close"
  >
    <div
      class="import-wizard"
      :class="{ 'import-wizard--animal': isAnimalIsland }"
    >
      <nav
        class="step-rail"
        aria-label="import steps"
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

      <!-- Step 1: 选择来源 -->
      <section
        v-if="step === 'source'"
        class="step-panel"
      >
        <p class="step-lead">
          {{ t('import.sourceLead') }}
        </p>
        <div class="source-grid">
          <button
            v-for="source in IMPORT_SOURCES"
            :key="source.id"
            type="button"
            class="source-card"
            :class="{ selected: selectedId === source.id }"
            :style="{ '--source-accent': source.accent }"
            @click="pickSource(source.id)"
          >
            <span
              class="source-monogram"
              aria-hidden="true"
            >{{ source.monogram }}</span>
            <span class="source-text">
              <span class="source-name">{{ t(`import.sources.${source.nameKey}`) }}</span>
              <span class="source-desc">{{ t(`import.sources.${source.descKey}`) }}</span>
            </span>
            <span
              v-if="selectedId === source.id"
              class="source-check"
            >
              <Check
                :size="14"
                :stroke-width="2.5"
              />
            </span>
          </button>
        </div>
      </section>

      <!-- Step 2: 上传文件 -->
      <section
        v-else-if="step === 'file'"
        class="step-panel step-panel--file"
      >
        <div
          v-if="selectedSource"
          class="source-banner"
        >
          <span
            class="banner-monogram"
            :style="{ background: `${selectedSource.accent}22`, color: selectedSource.accent }"
          >
            {{ selectedSource.monogram }}
          </span>
          <div>
            <p class="banner-title">
              {{ t(`import.sources.${selectedSource.nameKey}`) }}
            </p>
            <p class="banner-sub">
              {{ t('import.fileHint') }}
            </p>
          </div>
        </div>

        <button
          type="button"
          class="guide-toggle"
          @click="guideExpanded = !guideExpanded"
        >
          <HelpCircle
            :size="16"
            :stroke-width="1.5"
          />
          {{ t('import.exportGuide') }}
          <ChevronDown
            :size="16"
            :stroke-width="1.5"
            :class="{ open: guideExpanded }"
          />
        </button>
        <UiCard
          v-if="guideExpanded && selectedSource"
          class="guide-card"
        >
          <p>{{ t(`import.guides.${selectedSource.exportGuideKey}`) }}</p>
          <p
            v-if="selectedSource.expectedColumns.length"
            class="guide-columns"
          >
            <span class="guide-columns-label">{{ t('import.expectedColumns') }}</span>
            <code
              v-for="col in selectedSource.expectedColumns"
              :key="col"
            >{{ col }}</code>
          </p>
        </UiCard>

        <div
          class="drop-zone"
          :class="{ dragging: isDragging, filled: !!selectedFile, error: !!parseError }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop="onDrop"
          @click="openFilePicker"
        >
          <Upload
            :size="28"
            :stroke-width="1.25"
            class="drop-icon"
          />
          <p class="drop-title">
            {{ selectedFile ? selectedFile.name : t('import.dropTitle') }}
          </p>
          <p class="drop-sub">
            {{ isJsonSource ? t('import.dropSubJson') : t('import.dropSubCsv') }}
          </p>
        </div>

        <p
          v-if="parseError"
          class="inline-error"
        >
          <AlertCircle
            :size="14"
            :stroke-width="1.5"
          />
          {{ parseError }}
        </p>
      </section>

      <!-- Step 3: 检查确认 -->
      <section
        v-else-if="step === 'review'"
        class="step-panel step-panel--review"
      >
        <UiLoading
          v-if="previewLoading"
          class="review-loading"
        />
        <template v-else-if="previewResult">
          <p class="step-lead">
            {{
              t('import.reviewLead', {
                parsed: previewResult.totals.parsed,
                ready: previewResult.totals.ready,
                skipped: previewResult.totals.skipped,
                invalid: previewResult.totals.invalid,
              })
            }}
          </p>
          <p class="review-category-hint">
            {{
              isPwdbookNativeSource
                ? t('import.reviewCategoryJson')
                : t('import.reviewCategory', { name: previewResult.sourceCategoryName })
            }}
          </p>

          <p
            v-if="previewResult.attachments?.length"
            class="review-attachment-hint"
          >
            {{
              t('import.reviewAttachments', {
                count: previewResult.attachments.length,
              })
            }}
          </p>

          <p
            v-if="reviewTab === 'ready' && previewResult.totals.ready > 0"
            class="review-remove-hint"
          >
            {{ t('import.removeHint') }}
          </p>

          <div class="review-tabs">
            <button
              v-for="tab in reviewTabs"
              :key="tab.id"
              type="button"
              class="review-tab"
              :class="{ active: reviewTab === tab.id }"
              @click="reviewTab = tab.id"
            >
              {{ tab.label }}
            </button>
          </div>

          <div class="review-table-wrap">
            <table class="review-table">
              <thead>
                <tr>
                  <th>{{ t('import.colTitle') }}</th>
                  <th>{{ t('import.colAccount') }}</th>
                  <th>{{ t('import.colUrl') }}</th>
                  <th v-if="reviewTab !== 'ready'">
                    {{ t('import.colReason') }}
                  </th>
                  <th
                    v-else
                    class="col-action"
                  >
                    {{ t('import.colAction') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="reviewList.length === 0">
                  <td
                    colspan="4"
                    class="empty-cell"
                  >
                    {{ t('import.listEmpty') }}
                  </td>
                </tr>
                <tr
                  v-for="(item, index) in reviewList"
                  :key="`${reviewTab}-${item.row}-${index}`"
                >
                  <td>{{ item.title || `行 ${item.row}` }}</td>
                  <td>{{ item.username || '—' }}</td>
                  <td class="url-cell">
                    {{ item.url || '—' }}
                  </td>
                  <td
                    v-if="reviewTab !== 'ready'"
                    class="reason-cell"
                  >
                    {{ reasonLabel(item) }}
                  </td>
                  <td
                    v-else
                    class="col-action"
                  >
                    <button
                      type="button"
                      class="remove-row-btn"
                      :title="t('import.removeRow')"
                      :aria-label="t('import.removeRow')"
                      @click="removeReadyItem(index)"
                    >
                      <X
                        :size="16"
                        :stroke-width="1.5"
                      />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <p
          v-if="parseError"
          class="inline-error"
        >
          <AlertCircle
            :size="14"
            :stroke-width="1.5"
          />
          {{ parseError }}
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
          {{ step === 'source' ? t('common.cancel') : t('common.back') }}
        </UiButton>
        <div class="footer-actions">
          <UiButton
            v-if="step !== 'review'"
            variant="primary"
            :disabled="!canGoNext || previewLoading"
            :loading="previewLoading"
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
            :disabled="!canImport"
            :loading="committing"
            :title="!canImport ? t('import.noReadyToImport') : undefined"
            @click="handleImport"
          >
            {{
              canImport
                ? t('import.confirmImport', { n: previewResult?.totals.ready ?? 0 })
                : t('import.noReadyToImport')
            }}
          </UiButton>
        </div>
      </footer>
    </div>
  </UiModal>
</template>

<style scoped>
.import-wizard {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
}

.import-wizard--animal {
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

.step-panel--file {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
  column-gap: 16px;
  row-gap: 10px;
  align-items: start;
}

.step-panel--file .source-banner {
  grid-column: 1;
}

.step-panel--file .guide-toggle {
  grid-column: 1;
}

.step-panel--file .guide-card {
  grid-column: 1;
}

.step-panel--file .drop-zone {
  grid-column: 2;
  grid-row: 1 / span 4;
  min-height: 160px;
  align-self: stretch;
}

.step-panel--file .inline-error {
  grid-column: 1 / -1;
}

.step-lead {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.source-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.source-card {
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

.source-card:hover {
  border-color: var(--border-strong);
  background: var(--bg-hover);
}

.source-card.selected {
  border-color: var(--source-accent, var(--accent-primary));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--source-accent, var(--accent-primary)) 35%, transparent);
}

.source-monogram {
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
  background: color-mix(in srgb, var(--source-accent) 18%, var(--bg-surface));
  color: var(--source-accent);
}

.source-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.source-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.source-desc {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.35;
}

.source-check {
  position: absolute;
  top: 10px;
  right: 10px;
  color: var(--source-accent, var(--accent-primary));
}

.source-banner {
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

.guide-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: none;
  background: none;
  color: var(--accent-primary);
  font-size: 13px;
  cursor: pointer;
}

.guide-toggle svg.open {
  transform: rotate(180deg);
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

.guide-columns {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.guide-columns-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-right: 4px;
}

.guide-columns code {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg-hover);
  color: var(--text-primary);
}

.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 160px;
  padding: 28px;
  border-radius: var(--radius-lg);
  border: 2px dashed var(--border-strong);
  background: var(--bg-elevated);
  cursor: pointer;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.drop-zone:hover,
.drop-zone.dragging {
  border-color: var(--accent-primary);
  background: var(--accent-subtle);
}

.drop-zone.filled {
  border-style: solid;
  border-color: var(--border-accent);
}

.drop-zone.error {
  border-color: var(--status-danger);
}

.drop-icon {
  color: var(--text-muted);
}

.drop-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}

.drop-sub {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.inline-error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 12px;
  color: var(--status-danger);
}

.preview-summary {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  color: var(--text-secondary);
}

.preview-file {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.preview-meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.preview-caption {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.header-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 120px;
  overflow-y: auto;
}

.header-chip {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--bg-hover);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
}

.preview-note {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}

.json-hint-card {
  padding: 14px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.json-hint-card p {
  margin: 0;
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

.step-panel--review {
  gap: 10px;
}

.review-loading {
  padding: 24px;
  display: flex;
  justify-content: center;
}

.review-category-hint {
  margin: 0;
  font-size: 12px;
  color: var(--accent-primary);
}

.review-attachment-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.review-remove-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.review-table .col-action {
  width: 48px;
  text-align: center;
}

.remove-row-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s;
}

.remove-row-btn:hover {
  background: rgba(248, 113, 113, 0.12);
  color: var(--status-danger);
}

.review-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.review-tab {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.review-tab.active {
  border-color: var(--accent-primary);
  background: var(--accent-subtle);
  color: var(--text-primary);
}

.review-table-wrap {
  max-height: 280px;
  overflow: auto;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
}

.review-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.review-table th,
.review-table td {
  padding: 8px 10px;
  text-align: left;
  border-bottom: 1px solid var(--border-default);
}

.review-table th {
  position: sticky;
  top: 0;
  background: var(--bg-elevated);
  font-weight: 600;
  color: var(--text-secondary);
}

.review-table tr:last-child td {
  border-bottom: none;
}

.url-cell,
.reason-cell {
  color: var(--text-muted);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-cell {
  text-align: center;
  color: var(--text-muted);
  padding: 20px;
}
</style>

<style>
/* 经典主题：导入弹框加宽 */
.modal-overlay:has(.import-wizard) .modal-card {
  width: min(760px, calc(100vw - 48px));
  max-width: min(760px, calc(100vw - 48px));
}
</style>
