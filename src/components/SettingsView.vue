<script setup lang="ts">
import packageJson from '../../package.json'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowLeft,
  Shield,
  Palette,
  Database,
  Info,
  Download,
  Upload,
  AlertTriangle,
  ChevronRight,
  PanelTop,
} from 'lucide-vue-next'
import AppearancePanel from '@/components/AppearancePanel.vue'
import { UiSelect, UiSwitch, UiCard, UiButton } from '@/components/ui'
import { Footer } from 'animal-island-vue'
import { useTheme } from '@/composables/useTheme'
import RecoverySettingsPanel from '@/components/RecoverySettingsPanel.vue'
import ImportDataModal from '@/components/import/ImportDataModal.vue'
import ExportDataModal from '@/components/export/ExportDataModal.vue'
import { useAppState } from '@/composables/useAppState'
import type { SettingsTab } from '@/types'

const {
  settingsTab,
  switchSettingsTab,
  navigateTo,
  securitySettings,
  updateSecuritySettings,
  exportData,
  exportDataAsExcel,
  resetAllData,
  errorMessage,
  clearError,
} = useAppState()

const { t } = useI18n()
const { isAnimalIsland } = useTheme()

const statusMessage = ref('')
const importModalOpen = ref(false)
const exportModalOpen = ref(false)

const tabs = computed(() => [
  { id: 'security' as SettingsTab, label: t('settings.security'), icon: Shield },
  { id: 'appearance' as SettingsTab, label: t('settings.appearance'), icon: Palette },
  { id: 'data' as SettingsTab, label: t('settings.data'), icon: Database },
  { id: 'about' as SettingsTab, label: t('settings.about'), icon: Info },
])

const activeTab = computed(() => settingsTab.value)

const autoLockOptions = [5, 15, 30, 60]

const autoLockSelectOptions = computed(() =>
  autoLockOptions.map((minutes) => ({
    value: String(minutes),
    label: t('common.minutes', { n: minutes }),
  })),
)

const closeWindowOptions = computed(() => [
  { value: 'ask', label: t('settings.closeWindowAsk') },
  { value: 'tray', label: t('settings.closeWindowTray') },
  { value: 'quit', label: t('settings.closeWindowQuit') },
])

async function onAutoLockChange(value: string): Promise<void> {
  await updateSecuritySettings({ autoLockMinutes: Number(value) })
}

async function onClipboardClearChange(enabled: boolean): Promise<void> {
  await updateSecuritySettings({ clipboardClearEnabled: enabled })
}

async function onCloseWindowChange(value: string): Promise<void> {
  await updateSecuritySettings({ closeWindowAction: value as 'ask' | 'tray' | 'quit' })
}

async function onOpenUrlWithCredentialsChange(enabled: boolean): Promise<void> {
  await updateSecuritySettings({ openUrlWithCredentials: enabled })
}

async function onQuickBarEnabledChange(enabled: boolean): Promise<void> {
  await updateSecuritySettings({ quickBarEnabled: enabled })
}

async function onMainWindowShortcutEnabledChange(enabled: boolean): Promise<void> {
  await updateSecuritySettings({ mainWindowShortcutEnabled: enabled })
}

function openQuickBar(): void {
  window.electronAPI?.showQuickBar?.()
}

async function handleExportJson(): Promise<void> {
  clearError()
  statusMessage.value = ''
  try {
    const json = await exportData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `pwdbook-backup-${Date.now()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    statusMessage.value = t('settings.backupExported')
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : t('errors.export_failed')
  }
}

async function handleExportExcel(): Promise<void> {
  clearError()
  statusMessage.value = ''
  try {
    const bytes = await exportDataAsExcel()
    const blob = new Blob([new Uint8Array(bytes)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `pwdbook-backup-${Date.now()}.xlsx`
    anchor.click()
    URL.revokeObjectURL(url)
    statusMessage.value = t('settings.excelExported')
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : t('errors.export_failed')
  }
}

function openImportModal(): void {
  clearError()
  statusMessage.value = ''
  importModalOpen.value = true
}

function openExportModal(): void {
  clearError()
  statusMessage.value = ''
  exportModalOpen.value = true
}

function onImportCompleted(count: number): void {
  statusMessage.value = t('settings.importSuccess', { count })
}

function onExportCompleted(): void {
  statusMessage.value = t('export.exported')
}

async function handleReset(): Promise<void> {
  if (
    !window.confirm(t('settings.clearAllConfirm'))
  ) {
    return
  }
  await resetAllData()
  statusMessage.value = t('settings.dataCleared')
}
</script>

<template>
  <div class="settings-view">
    <div class="settings-body">
      <aside class="settings-sidebar">
        <button type="button" class="back-btn" @click="navigateTo('vault')">
          <ArrowLeft :size="16" :stroke-width="1.5" />
          {{ t('common.back') }}
        </button>
        <h2 class="font-display sidebar-title">{{ t('settings.title') }}</h2>
        <nav class="settings-nav">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="settings-tab"
            :class="{ active: activeTab === tab.id }"
            @click="switchSettingsTab(tab.id)"
          >
            <component :is="tab.icon" :size="16" :stroke-width="1.5" />
            {{ tab.label }}
          </button>
        </nav>
      </aside>

      <main class="settings-main">
        <div v-if="activeTab === 'security'" class="panel">
          <h3>{{ t('settings.security') }}</h3>
          <UiCard class="settings-card">
            <div class="row">
              <div>
                <p class="row-title">{{ t('settings.autoLock') }}</p>
                <p class="row-desc">{{ t('settings.autoLockDesc') }}</p>
              </div>
              <UiSelect
                :model-value="String(securitySettings.autoLockMinutes)"
                class="settings-select"
                :options="autoLockSelectOptions"
                @update:model-value="onAutoLockChange"
              />
            </div>
            <div class="row">
              <div>
                <p class="row-title">{{ t('settings.clipboardClear') }}</p>
                <p class="row-desc">
                  {{ t('settings.clipboardClearDesc', { seconds: securitySettings.clipboardClearSeconds }) }}
                </p>
              </div>
              <UiSwitch
                :model-value="securitySettings.clipboardClearEnabled"
                @update:model-value="onClipboardClearChange"
              />
            </div>
            <div class="row">
              <div>
                <p class="row-title">{{ t('settings.openUrlWithCredentials') }}</p>
                <p class="row-desc">{{ t('settings.openUrlWithCredentialsDesc') }}</p>
              </div>
              <UiSwitch
                :model-value="securitySettings.openUrlWithCredentials"
                @update:model-value="onOpenUrlWithCredentialsChange"
              />
            </div>
            <div class="row">
              <div>
                <p class="row-title">{{ t('settings.closeWindow') }}</p>
                <p class="row-desc">{{ t('settings.closeWindowDesc') }}</p>
              </div>
              <UiSelect
                :model-value="securitySettings.closeWindowAction"
                class="settings-select"
                :options="closeWindowOptions"
                @update:model-value="onCloseWindowChange"
              />
            </div>
            <div class="row quickbar-row">
              <div>
                <p class="row-title">{{ t('settings.quickBar') }}</p>
                <p class="row-desc">
                  {{ t('settings.quickBarDesc', { accelerator: securitySettings.quickBarAccelerator }) }}
                </p>
                <UiButton
                  v-if="securitySettings.quickBarEnabled"
                  variant="default"
                  size="small"
                  class="quickbar-open-btn"
                  @click="openQuickBar"
                >
                  <PanelTop :size="14" :stroke-width="1.75" />
                  {{ t('settings.quickBarOpen') }}
                </UiButton>
              </div>
              <UiSwitch
                :model-value="securitySettings.quickBarEnabled"
                @update:model-value="onQuickBarEnabledChange"
              />
            </div>
            <div class="row last">
              <div>
                <p class="row-title">{{ t('settings.mainWindowShortcut') }}</p>
                <p class="row-desc">
                  {{
                    t('settings.mainWindowShortcutDesc', {
                      accelerator: securitySettings.mainWindowShortcutAccelerator,
                    })
                  }}
                </p>
              </div>
              <UiSwitch
                :model-value="securitySettings.mainWindowShortcutEnabled"
                @update:model-value="onMainWindowShortcutEnabledChange"
              />
            </div>
          </UiCard>

          <RecoverySettingsPanel />
        </div>

        <AppearancePanel v-else-if="activeTab === 'appearance'" />

        <div v-else-if="activeTab === 'data'" class="panel">
          <h3>{{ t('settings.data') }}</h3>
          <p v-if="statusMessage" class="status-message">{{ statusMessage }}</p>
          <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
          <div class="surface-card settings-card">
            <button type="button" class="link-row" @click="handleExportJson">
              <span><Download :size="16" :stroke-width="1.5" /> {{ t('settings.exportJson') }}</span>
              <ChevronRight :size="16" :stroke-width="1.5" />
            </button>
            <button type="button" class="link-row" @click="handleExportExcel">
              <span><Download :size="16" :stroke-width="1.5" /> {{ t('settings.exportExcel') }}</span>
              <ChevronRight :size="16" :stroke-width="1.5" />
            </button>
            <button type="button" class="link-row" @click="openExportModal">
              <span><Download :size="16" :stroke-width="1.5" /> {{ t('settings.exportToApps') }}</span>
              <ChevronRight :size="16" :stroke-width="1.5" />
            </button>
            <ExportDataModal v-model:open="exportModalOpen" @exported="onExportCompleted" />
            <button type="button" class="link-row" @click="openImportModal">
              <span><Upload :size="16" :stroke-width="1.5" /> {{ t('settings.importData') }}</span>
              <ChevronRight :size="16" :stroke-width="1.5" />
            </button>
            <ImportDataModal v-model:open="importModalOpen" @imported="onImportCompleted" />
            <button type="button" class="link-row danger-row" @click="handleReset">
              <span><AlertTriangle :size="16" :stroke-width="1.5" /> {{ t('settings.clearAllData') }}</span>
              <ChevronRight :size="16" :stroke-width="1.5" />
            </button>
          </div>
        </div>

        <div v-else-if="activeTab === 'about'" class="panel about-panel">
          <h3>{{ t('settings.about') }}</h3>
          <UiCard class="about-card">
            <p class="font-display about-title">{{ t('common.appName') }}</p>
            <p class="about-version">{{ t('settings.version', { version: packageJson.version }) }}</p>
            <p class="about-desc">{{ t('settings.aboutDesc') }}</p>
            <p class="about-credit">{{ t('settings.animalIslandCredit') }}</p>
          </UiCard>
          <Footer v-if="isAnimalIsland" type="tree" class="about-footer" />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.settings-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.settings-sidebar {
  width: var(--sidebar-width);
  padding: 16px;
  background: var(--bg-surface);
  border-right: 1px solid var(--border-default);
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  margin-bottom: 24px;
  padding: 0;
}

.back-btn:hover {
  color: var(--text-primary);
}

.sidebar-title {
  font-size: 20px;
  letter-spacing: -0.02em;
  margin: 0 0 16px 8px;
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-main {
  flex: 1;
  overflow-y: auto;
  padding: 32px;
}

.panel {
  max-width: 640px;
}

h3 {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.status-message {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--status-success);
}

.error-message {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--status-danger);
}

.settings-card {
  overflow: hidden;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-default);
}

.row.last {
  border-bottom: none;
}

.row-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}

.row-desc {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.quickbar-open-btn {
  margin-top: 10px;
}

.select {
  font-size: 14px;
  padding: 6px 12px;
  border-radius: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  color: var(--text-primary);
}

.toggle {
  width: 44px;
  height: 24px;
  border-radius: 999px;
  background: var(--toggle-off);
  position: relative;
  flex-shrink: 0;
  border: none;
  cursor: pointer;
  padding: 0;
}

.toggle.on {
  background: var(--accent-primary);
}

.toggle.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: var(--toggle-knob);
}

.toggle.on .knob {
  left: auto;
  right: 2px;
  background: var(--btn-primary-text);
}

.link-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border: none;
  border-bottom: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.link-row span {
  display: flex;
  align-items: center;
  gap: 12px;
}

.link-row:hover {
  background: var(--bg-hover);
}

.link-row:last-child {
  border-bottom: none;
}

.danger-row {
  color: var(--status-danger);
}

.danger-row:hover {
  background: rgba(248, 113, 113, 0.06);
}

.about-card {
  padding: 20px;
}

.about-title {
  margin: 0 0 4px;
  font-size: 18px;
}

.about-version {
  margin: 0 0 16px;
  font-size: 12px;
  color: var(--text-muted);
}

.about-credit {
  margin: 16px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}

.about-footer {
  margin-top: 24px;
}

.about-desc {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}
</style>
