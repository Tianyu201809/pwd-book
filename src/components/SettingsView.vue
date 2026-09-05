<script setup lang="ts">
import packageJson from '../../package.json'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowLeft,
  Shield,
  Clipboard,
  Globe,
  PanelTop,
  Trash2,
  Palette,
  Database,
  Info,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
  MailCheck,
} from 'lucide-vue-next'
import AppearancePanel from '@/components/AppearancePanel.vue'
import BrowserSettingsPanel from '@/components/BrowserSettingsPanel.vue'
import ClipboardSettingsPanel from '@/components/ClipboardSettingsPanel.vue'
import QuickBarSettingsPanel from '@/components/QuickBarSettingsPanel.vue'
import TrashSettingsPanel from '@/components/TrashSettingsPanel.vue'
import IconBadge from '@/components/IconBadge.vue'
import { NAV_ICON_STYLES } from '@/shared/navIconStyles'
import { UiSelect, UiSwitch, UiCard, UiButton } from '@/components/ui'
import { Footer } from 'animal-island-vue'
import { useTheme } from '@/composables/useTheme'
import RecoverySettingsPanel from '@/components/RecoverySettingsPanel.vue'
import ImportDataModal from '@/components/import/ImportDataModal.vue'
import ExportDataModal from '@/components/export/ExportDataModal.vue'
import { useAppState } from '@/composables/useAppState'
import type { ExportDestinationId } from '@/shared/exportFormats'
import type { SettingsTab } from '@/types'
import { AUTO_LOCK_FOLLOW_SYSTEM } from '@/shared/types'

const {
  settingsTab,
  switchSettingsTab,
  navigateTo,
  securitySettings,
  updateSecuritySettings,
  resetAllData,
  openSync,
  openEmailBackup,
  errorMessage,
  clearError,
} = useAppState()

const { t } = useI18n()
const { isAnimalIsland } = useTheme()

const statusMessage = ref('')
const importModalOpen = ref(false)
const exportModalOpen = ref(false)
const launchAtLoginAvailable = ref(true)

const tabs = computed(() => [
  { id: 'security' as SettingsTab, label: t('settings.security'), icon: Shield, iconStyle: NAV_ICON_STYLES.shield },
  { id: 'clipboard' as SettingsTab, label: t('settings.clipboardTab'), icon: Clipboard, iconStyle: NAV_ICON_STYLES.clipboard },
  { id: 'browser' as SettingsTab, label: t('settings.browserTab'), icon: Globe, iconStyle: NAV_ICON_STYLES.browser },
  { id: 'quickbar' as SettingsTab, label: t('settings.quickBarTab'), icon: PanelTop, iconStyle: NAV_ICON_STYLES.quickbar },
  { id: 'trash' as SettingsTab, label: t('settings.trashTab'), icon: Trash2, iconStyle: NAV_ICON_STYLES.trash },
  { id: 'appearance' as SettingsTab, label: t('settings.appearance'), icon: Palette, iconStyle: NAV_ICON_STYLES.palette },
  { id: 'data' as SettingsTab, label: t('settings.data'), icon: Database, iconStyle: NAV_ICON_STYLES.database },
  { id: 'about' as SettingsTab, label: t('settings.about'), icon: Info, iconStyle: NAV_ICON_STYLES.info },
])

const activeTab = computed(() => settingsTab.value)

const autoLockOptions = [5, 15, 30, 60, 120]

const autoLockSelectOptions = computed(() => [
  ...autoLockOptions.map((minutes) => ({
    value: String(minutes),
    label: t('common.minutes', { n: minutes }),
  })),
  {
    value: String(AUTO_LOCK_FOLLOW_SYSTEM),
    label: t('settings.autoLockFollowSystem'),
  },
])

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

async function onLaunchAtLoginChange(enabled: boolean): Promise<void> {
  await updateSecuritySettings({ launchAtLoginEnabled: enabled })
}

onMounted(() => {
  void window.electronAPI?.isLaunchAtLoginAvailable?.().then((available) => {
    launchAtLoginAvailable.value = available
  })
})

function openExportModal(): void {
  clearError()
  statusMessage.value = ''
  exportModalOpen.value = true
}

function openImportModal(): void {
  clearError()
  statusMessage.value = ''
  importModalOpen.value = true
}

function onImportCompleted(count: number): void {
  statusMessage.value = t('settings.importSuccess', { count })
}

function onExportCompleted(formatId: ExportDestinationId): void {
  if (formatId === 'pwdbook-json') {
    statusMessage.value = t('export.exportedJson')
    return
  }
  if (formatId === 'pwdbook-xlsx') {
    statusMessage.value = t('export.exportedExcel')
    return
  }
  statusMessage.value = t('export.exportedCsv')
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
        <button
          type="button"
          class="back-btn"
          @click="navigateTo('vault')"
        >
          <ArrowLeft
            :size="16"
            :stroke-width="1.5"
          />
          {{ t('common.back') }}
        </button>
        <h2 class="font-display sidebar-title">
          {{ t('settings.title') }}
        </h2>
        <nav
          class="settings-nav"
          data-tour="settings-nav"
        >
          <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            class="settings-tab"
            :class="{ active: activeTab === tab.id }"
            @click="switchSettingsTab(tab.id)"
          >
            <IconBadge v-bind="tab.iconStyle">
              <component
                :is="tab.icon"
                :size="14"
                :stroke-width="1.5"
              />
            </IconBadge>
            {{ tab.label }}
          </button>
        </nav>
      </aside>

      <main class="settings-main">
        <div
          v-if="activeTab === 'security'"
          class="panel"
          data-tour="settings-security"
        >
          <h3>{{ t('settings.security') }}</h3>
          <UiCard class="settings-card">
            <div class="row">
              <div>
                <p class="row-title">
                  {{ t('settings.launchAtLogin') }}
                </p>
                <p class="row-desc">
                  {{ t('settings.launchAtLoginDesc') }}
                </p>
                <p
                  v-if="!launchAtLoginAvailable"
                  class="row-desc row-desc--hint"
                >
                  {{ t('settings.launchAtLoginPackagedOnly') }}
                </p>
              </div>
              <UiSwitch
                :model-value="securitySettings.launchAtLoginEnabled"
                :disabled="!launchAtLoginAvailable"
                @update:model-value="onLaunchAtLoginChange"
              />
            </div>
            <div class="row">
              <div>
                <p class="row-title">
                  {{ t('settings.autoLock') }}
                </p>
                <p class="row-desc">
                  {{ t('settings.autoLockDesc') }}
                </p>
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
                <p class="row-title">
                  {{ t('settings.clipboardClear') }}
                </p>
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
                <p class="row-title">
                  {{ t('settings.closeWindow') }}
                </p>
                <p class="row-desc">
                  {{ t('settings.closeWindowDesc') }}
                </p>
              </div>
              <UiSelect
                :model-value="securitySettings.closeWindowAction"
                class="settings-select"
                :options="closeWindowOptions"
                @update:model-value="onCloseWindowChange"
              />
            </div>
            <div class="row email-backup-row last">
              <div>
                <p class="row-title">
                  {{ t('tools.emailBackupTitle') }}
                </p>
                <p class="row-desc">
                  {{ t('tools.emailBackupDesc') }}
                </p>
                <UiButton
                  variant="default"
                  size="small"
                  class="email-backup-open-btn"
                  @click="openEmailBackup"
                >
                  <MailCheck
                    :size="14"
                    :stroke-width="1.75"
                  />
                  {{ t('settings.emailBackupOpen') }}
                </UiButton>
              </div>
            </div>
          </UiCard>

          <RecoverySettingsPanel />
        </div>

        <ClipboardSettingsPanel v-else-if="activeTab === 'clipboard'" />

        <BrowserSettingsPanel v-else-if="activeTab === 'browser'" />

        <QuickBarSettingsPanel v-else-if="activeTab === 'quickbar'" />

        <TrashSettingsPanel v-else-if="activeTab === 'trash'" />

        <AppearancePanel v-else-if="activeTab === 'appearance'" />

        <div
          v-else-if="activeTab === 'data'"
          class="panel"
          data-tour="settings-data"
        >
          <h3>{{ t('settings.data') }}</h3>
          <p
            v-if="statusMessage"
            class="status-message"
          >
            {{ statusMessage }}
          </p>
          <p
            v-if="errorMessage"
            class="error-message"
          >
            {{ errorMessage }}
          </p>
          <div class="surface-card settings-card">
            <button
              type="button"
              class="link-row"
              @click="openExportModal"
            >
              <span><Download
                :size="16"
                :stroke-width="1.5"
              /> {{ t('settings.exportData') }}</span>
              <ChevronRight
                :size="16"
                :stroke-width="1.5"
              />
            </button>
            <ExportDataModal
              v-model:open="exportModalOpen"
              @exported="onExportCompleted"
            />
            <button
              type="button"
              class="link-row"
              @click="openImportModal"
            >
              <span><Upload
                :size="16"
                :stroke-width="1.5"
              /> {{ t('settings.importData') }}</span>
              <ChevronRight
                :size="16"
                :stroke-width="1.5"
              />
            </button>
            <ImportDataModal
              v-model:open="importModalOpen"
              @imported="onImportCompleted"
            />
            <button
              type="button"
              class="link-row"
              @click="openSync"
            >
              <span><RefreshCw
                :size="16"
                :stroke-width="1.5"
              /> {{ t('settings.sync') }}</span>
              <ChevronRight
                :size="16"
                :stroke-width="1.5"
              />
            </button>
            <button
              type="button"
              class="link-row danger-row"
              @click="handleReset"
            >
              <span><AlertTriangle
                :size="16"
                :stroke-width="1.5"
              /> {{ t('settings.clearAllData') }}</span>
              <ChevronRight
                :size="16"
                :stroke-width="1.5"
              />
            </button>
          </div>
        </div>

        <div
          v-else-if="activeTab === 'about'"
          class="panel about-panel"
        >
          <h3>{{ t('settings.about') }}</h3>
          <UiCard class="about-card">
            <p class="font-display about-title">
              {{ t('common.appName') }}
            </p>
            <p class="about-version">
              {{ t('settings.version', { version: packageJson.version }) }}
            </p>
            <p class="about-desc">
              {{ t('settings.aboutDesc') }}
            </p>
          </UiCard>
          <Footer
            v-if="isAnimalIsland"
            type="tree"
            class="about-footer"
          />
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
  overflow-y: auto;
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

.row-desc--hint {
  margin-top: 6px;
  color: var(--status-warning, #c99700);
}

.email-backup-open-btn {
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

.about-footer {
  margin-top: 24px;
}

.about-desc {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}
</style>
