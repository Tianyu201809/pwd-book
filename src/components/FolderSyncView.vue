<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowLeft,
  Cloud,
  FolderOpen,
  HardDrive,
  Loader2,
  RefreshCw,
} from 'lucide-vue-next'
import MasterPasswordConfirmModal from '@/components/MasterPasswordConfirmModal.vue'
import SyncConflictModal from '@/components/sync/SyncConflictModal.vue'
import { UiButton, UiCheckbox } from '@/components/ui'
import { useAppState } from '@/composables/useAppState'
import { showToast } from '@/composables/useToast'
import { parseErrorMessage } from '@/shared/utils'
import type { SyncConflict, SyncMergeResult } from '@/shared/syncTypes'

const {
  navigateTo,
  folderSyncSettings,
  folderSyncStatus,
  syncStatus,
  loadFolderSyncState,
  pickFolderSyncDirectory,
  connectFolderSync,
  disconnectFolderSync,
  updateFolderSyncAutoSync,
  syncFolderNow,
} = useAppState()

const { t } = useI18n()

const pickingFolder = ref(false)
const syncLoading = ref(false)
const disconnectLoading = ref(false)
const pendingFolderPath = ref<string | null>(null)
const showMasterModal = ref(false)
const masterModalRef = ref<InstanceType<typeof MasterPasswordConfirmModal> | null>(null)
const pendingAction = ref<'connect' | 'sync' | null>(null)
const syncConflicts = ref<SyncConflict[]>([])
const showConflictModal = ref(false)

const connected = computed(() => folderSyncStatus.value.connected)

const lastSyncedText = computed(() => {
  const at = syncStatus.value.lastSyncedAt
  if (!at) return t('tools.folderSync.lastSyncedNever')
  return t('tools.folderSync.lastSynced', { time: new Date(at).toLocaleString() })
})

const lastPublishedText = computed(() => {
  const at = folderSyncStatus.value.lastPublishedAt
  if (!at) return t('tools.folderSync.neverPublished')
  return new Date(at).toLocaleString()
})

const bundleSizeText = computed(() => {
  const bytes = folderSyncStatus.value.bundleSizeBytes
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
})

const bundleModifiedText = computed(() => {
  const at = folderSyncStatus.value.bundleModifiedAt
  if (!at) return '—'
  return new Date(at).toLocaleString()
})

const tutorialSteps = computed(() => [
  t('tools.folderSync.tutorial.steps.0.title'),
  t('tools.folderSync.tutorial.steps.1.title'),
  t('tools.folderSync.tutorial.steps.2.title'),
])

onMounted(() => {
  void loadFolderSyncState()
})

function goBack(): void {
  navigateTo('sync')
}

function handleSyncResult(result: SyncMergeResult, successKey: 'connectSuccess' | 'syncSuccess'): void {
  if (result.conflicts.length > 0) {
    syncConflicts.value = result.conflicts
    showConflictModal.value = true
    showToast(
      t(`tools.folderSync.${successKey}WithConflicts`, {
        added: result.added,
        updated: result.updated,
        conflicts: result.conflicts.length,
      }),
      'success',
    )
    return
  }
  showToast(
    t(`tools.folderSync.${successKey}`, {
      added: result.added,
      updated: result.updated,
    }),
    'success',
  )
}

async function handlePickFolder(): Promise<void> {
  pickingFolder.value = true
  try {
    const path = await pickFolderSyncDirectory()
    if (!path) return
    pendingFolderPath.value = path
    pendingAction.value = 'connect'
    showMasterModal.value = true
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  } finally {
    pickingFolder.value = false
  }
}

function openSyncNow(): void {
  pendingAction.value = 'sync'
  showMasterModal.value = true
}

async function confirmMasterPassword(masterPassword: string): Promise<void> {
  syncLoading.value = true
  try {
    if (pendingAction.value === 'connect' && pendingFolderPath.value) {
      const result = await connectFolderSync(pendingFolderPath.value, masterPassword)
      handleSyncResult(result, 'connectSuccess')
      pendingFolderPath.value = null
    } else if (pendingAction.value === 'sync') {
      const result = await syncFolderNow(masterPassword)
      handleSyncResult(result, 'syncSuccess')
    }
    masterModalRef.value?.resetPassword()
    showMasterModal.value = false
    pendingAction.value = null
    await loadFolderSyncState()
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  } finally {
    syncLoading.value = false
  }
}

async function handleAutoSyncChange(checked: boolean): Promise<void> {
  try {
    await updateFolderSyncAutoSync(checked)
    showToast(
      checked ? t('tools.folderSync.autoSyncEnabled') : t('tools.folderSync.autoSyncDisabled'),
      'success',
    )
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  }
}

async function handleDisconnect(): Promise<void> {
  if (!window.confirm(t('tools.folderSync.disconnectConfirm'))) return
  disconnectLoading.value = true
  try {
    await disconnectFolderSync()
    showToast(t('tools.folderSync.disconnected'), 'success')
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  } finally {
    disconnectLoading.value = false
  }
}
</script>

<template>
  <div class="tool-page-view">
    <div class="tool-page-body">
      <aside class="tool-page-sidebar">
        <button
          type="button"
          class="tool-back-btn"
          @click="goBack"
        >
          <ArrowLeft
            :size="16"
            :stroke-width="1.5"
          />
          {{ t('tools.folderSync.backToSync') }}
        </button>

        <div class="tool-sidebar-hero">
          <div class="tool-hero-icon tool-hero-icon--folder">
            <FolderOpen
              :size="22"
              :stroke-width="1.5"
            />
          </div>
          <h2 class="tool-sidebar-title font-display">
            {{ t('tools.folderSync.title') }}
          </h2>
          <p class="tool-sidebar-desc">
            {{ t('tools.folderSync.subtitle') }}
          </p>
        </div>
      </aside>

      <main class="tool-page-main">
        <div class="tool-page-content">
          <div class="sync-status-bar surface-card">
            <p class="sync-status-title">
              {{ t('tools.folderSync.syncStatusTitle') }}
            </p>
            <p class="sync-status-line">
              {{ t('tools.folderSync.syncRevision', { revision: syncStatus.revision }) }}
            </p>
            <p class="sync-status-line">
              {{ lastSyncedText }}
            </p>
          </div>

          <section
            v-if="!connected"
            class="panel-glow surface-card folder-panel folder-panel--setup"
          >
            <h3 class="folder-panel__title">
              {{ t('tools.folderSync.notConnectedTitle') }}
            </h3>
            <p class="folder-panel__desc">
              {{ t('tools.folderSync.notConnectedDesc') }}
            </p>

            <div class="cloud-hints">
              <p class="cloud-hints__title">
                {{ t('tools.folderSync.cloudHintsTitle') }}
              </p>
              <div class="cloud-hints__chips">
                <span class="cloud-chip">
                  <Cloud
                    :size="14"
                    :stroke-width="1.5"
                  />
                  {{ t('tools.folderSync.cloudDropbox') }}
                </span>
                <span class="cloud-chip">
                  <Cloud
                    :size="14"
                    :stroke-width="1.5"
                  />
                  {{ t('tools.folderSync.cloudOneDrive') }}
                </span>
                <span class="cloud-chip">
                  <HardDrive
                    :size="14"
                    :stroke-width="1.5"
                  />
                  {{ t('tools.folderSync.cloudLocal') }}
                </span>
              </div>
            </div>

            <UiButton
              class="folder-primary-btn"
              variant="primary"
              :disabled="pickingFolder"
              @click="handlePickFolder"
            >
              <Loader2
                v-if="pickingFolder"
                :size="16"
                class="spin"
              />
              <FolderOpen
                v-else
                :size="16"
                :stroke-width="1.5"
              />
              {{ t('tools.folderSync.selectFolder') }}
            </UiButton>
          </section>

          <section
            v-else
            class="panel-glow surface-card folder-panel"
          >
            <h3 class="folder-panel__title">
              {{ t('tools.folderSync.connectedTitle') }}
            </h3>

            <div class="folder-path-card">
              <span class="folder-path-label">{{ t('tools.folderSync.folderPath') }}</span>
              <code class="folder-path-value">{{ folderSyncStatus.folderPath }}</code>
            </div>

            <div class="bundle-info-card">
              <div class="bundle-info-row">
                <span>{{ t('tools.folderSync.bundleFile') }}</span>
                <strong>
                  {{
                    folderSyncStatus.bundleExists
                      ? t('tools.folderSync.bundleExists')
                      : t('tools.folderSync.bundleMissing')
                  }}
                </strong>
              </div>
              <div
                v-if="folderSyncStatus.bundleExists"
                class="bundle-info-row"
              >
                <span>{{ t('tools.folderSync.bundleSize', { size: bundleSizeText }) }}</span>
              </div>
              <div
                v-if="folderSyncStatus.bundleExists"
                class="bundle-info-row"
              >
                <span>{{ t('tools.folderSync.bundleModified', { time: bundleModifiedText }) }}</span>
              </div>
              <div class="bundle-info-row">
                <span>{{ t('tools.folderSync.lastPublished') }}</span>
                <span>{{ lastPublishedText }}</span>
              </div>
            </div>

            <div class="auto-sync-block">
              <UiCheckbox
                :model-value="folderSyncSettings.autoSync"
                :label="t('tools.folderSync.autoSync')"
                @update:model-value="handleAutoSyncChange"
              />
              <p class="auto-sync-desc">
                {{ t('tools.folderSync.autoSyncDesc') }}
              </p>
            </div>

            <UiButton
              class="folder-primary-btn"
              variant="primary"
              :disabled="syncLoading"
              @click="openSyncNow"
            >
              <Loader2
                v-if="syncLoading"
                :size="16"
                class="spin"
              />
              <RefreshCw
                v-else
                :size="16"
                :stroke-width="1.5"
              />
              {{ t('tools.folderSync.syncNow') }}
            </UiButton>

            <div class="folder-secondary-actions">
              <UiButton
                variant="default"
                size="small"
                :disabled="pickingFolder"
                @click="handlePickFolder"
              >
                {{ t('tools.folderSync.changeFolder') }}
              </UiButton>
              <UiButton
                variant="ghost"
                size="small"
                :disabled="disconnectLoading"
                @click="handleDisconnect"
              >
                {{ t('tools.folderSync.disconnect') }}
              </UiButton>
            </div>
          </section>

          <section class="tutorial-card surface-card">
            <p class="tutorial-card__title">
              {{ t('tools.folderSync.tutorial.title') }}
            </p>
            <p class="tutorial-card__subtitle">
              {{ t('tools.folderSync.tutorial.subtitle') }}
            </p>
            <ol class="tutorial-steps">
              <li
                v-for="(stepTitle, index) in tutorialSteps"
                :key="stepTitle"
              >
                <strong>{{ stepTitle }}</strong>
                <span>{{ t(`tools.folderSync.tutorial.steps.${index}.desc`) }}</span>
              </li>
            </ol>
          </section>
        </div>
      </main>
    </div>

    <MasterPasswordConfirmModal
      ref="masterModalRef"
      v-model:open="showMasterModal"
      :title="t('tools.folderSync.masterPasswordTitle')"
      :description="t('tools.folderSync.masterPasswordDesc')"
      :confirm-label="
        pendingAction === 'connect'
          ? t('tools.folderSync.confirmConnect')
          : t('tools.folderSync.confirmSync')
      "
      :loading="syncLoading"
      @confirm="confirmMasterPassword"
    />

    <SyncConflictModal
      :open="showConflictModal"
      :conflicts="syncConflicts"
      @close="showConflictModal = false"
    />
  </div>
</template>

<style scoped>
.tool-sidebar-hero {
  margin-bottom: 20px;
}

.sync-status-bar {
  margin-bottom: 14px;
  padding: 12px 14px;
  border: 1px solid var(--border-default);
  background: var(--bg-elevated);
}

.sync-status-title {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
}

.sync-status-line {
  margin: 0;
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.folder-panel {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 14px;
}

.folder-panel--setup {
  background:
    radial-gradient(circle at top right, rgba(251, 191, 36, 0.08), transparent 55%),
    var(--bg-elevated);
}

.folder-panel__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.folder-panel__desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-secondary);
}

.cloud-hints {
  padding: 12px;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border-default);
  background: rgba(0, 0, 0, 0.02);
}

.cloud-hints__title {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}

.cloud-hints__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cloud-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 11px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  color: var(--text-secondary);
}

.folder-primary-btn {
  width: 100%;
}

.folder-path-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
}

.folder-path-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.folder-path-value {
  font-family: var(--font-mono);
  font-size: 11px;
  word-break: break-all;
  line-height: 1.5;
}

.bundle-info-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
}

.bundle-info-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 11px;
  color: var(--text-secondary);
}

.bundle-info-row strong {
  color: var(--text-primary);
  font-weight: 600;
}

.auto-sync-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.auto-sync-desc {
  margin: 0;
  padding-left: 24px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.folder-secondary-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tutorial-card {
  padding: 16px 18px;
}

.tutorial-card__title {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 600;
}

.tutorial-card__subtitle {
  margin: 0 0 12px;
  font-size: 11px;
  color: var(--text-secondary);
}

.tutorial-steps {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tutorial-steps li {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.55;
}

.tutorial-steps strong {
  display: block;
  color: var(--text-primary);
  font-size: 12px;
  margin-bottom: 2px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
