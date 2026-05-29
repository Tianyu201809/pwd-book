<script setup lang="ts">
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
} from 'lucide-vue-next'
import AppearancePanel from '@/components/AppearancePanel.vue'
import RecoverySettingsPanel from '@/components/RecoverySettingsPanel.vue'
import { useAppState } from '@/composables/useAppState'
import type { SettingsTab } from '@/types'

const {
  settingsTab,
  switchSettingsTab,
  navigateTo,
  securitySettings,
  updateSecuritySettings,
  exportData,
  importDataFromJson,
  resetAllData,
  errorMessage,
  clearError,
} = useAppState()

const { t } = useI18n()

const statusMessage = ref('')

const tabs = computed(() => [
  { id: 'security' as SettingsTab, label: t('settings.security'), icon: Shield },
  { id: 'appearance' as SettingsTab, label: t('settings.appearance'), icon: Palette },
  { id: 'data' as SettingsTab, label: t('settings.data'), icon: Database },
  { id: 'about' as SettingsTab, label: t('settings.about'), icon: Info },
])

const activeTab = computed(() => settingsTab.value)

const autoLockOptions = [5, 15, 30, 60]

async function onAutoLockChange(event: Event): Promise<void> {
  const value = Number((event.target as HTMLSelectElement).value)
  await updateSecuritySettings({ autoLockMinutes: value })
}

async function toggleClipboardClear(): Promise<void> {
  await updateSecuritySettings({
    clipboardClearEnabled: !securitySettings.value.clipboardClearEnabled,
  })
}

async function handleExport(): Promise<void> {
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

async function handleImport(): Promise<void> {
  clearError()
  statusMessage.value = ''
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json,.json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const count = await importDataFromJson(text)
      statusMessage.value = t('settings.importSuccess', { count })
    } catch (error) {
      statusMessage.value = error instanceof Error ? error.message : t('errors.import_failed')
    }
  }
  input.click()
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
          <div class="surface-card settings-card">
            <div class="row">
              <div>
                <p class="row-title">{{ t('settings.autoLock') }}</p>
                <p class="row-desc">{{ t('settings.autoLockDesc') }}</p>
              </div>
              <select
                class="select"
                :value="securitySettings.autoLockMinutes"
                @change="onAutoLockChange"
              >
                <option v-for="minutes in autoLockOptions" :key="minutes" :value="minutes">
                  {{ t('common.minutes', { n: minutes }) }}
                </option>
              </select>
            </div>
            <div class="row last">
              <div>
                <p class="row-title">{{ t('settings.clipboardClear') }}</p>
                <p class="row-desc">
                  {{ t('settings.clipboardClearDesc', { seconds: securitySettings.clipboardClearSeconds }) }}
                </p>
              </div>
              <button
                type="button"
                class="toggle"
                :class="{ on: securitySettings.clipboardClearEnabled }"
                @click="toggleClipboardClear"
              >
                <span class="knob" />
              </button>
            </div>
          </div>

          <RecoverySettingsPanel />
        </div>

        <AppearancePanel v-else-if="activeTab === 'appearance'" />

        <div v-else-if="activeTab === 'data'" class="panel">
          <h3>{{ t('settings.data') }}</h3>
          <p v-if="statusMessage" class="status-message">{{ statusMessage }}</p>
          <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
          <div class="surface-card settings-card">
            <button type="button" class="link-row" @click="handleExport">
              <span><Download :size="16" :stroke-width="1.5" /> {{ t('settings.exportBackup') }}</span>
              <ChevronRight :size="16" :stroke-width="1.5" />
            </button>
            <button type="button" class="link-row" @click="handleImport">
              <span><Upload :size="16" :stroke-width="1.5" /> {{ t('settings.importData') }}</span>
              <ChevronRight :size="16" :stroke-width="1.5" />
            </button>
            <button type="button" class="link-row danger-row" @click="handleReset">
              <span><AlertTriangle :size="16" :stroke-width="1.5" /> {{ t('settings.clearAllData') }}</span>
              <ChevronRight :size="16" :stroke-width="1.5" />
            </button>
          </div>
        </div>

        <div v-else-if="activeTab === 'about'" class="panel">
          <h3>{{ t('settings.about') }}</h3>
          <div class="surface-card about-card">
            <p class="font-display about-title">{{ t('common.appName') }}</p>
            <p class="about-version">{{ t('settings.version', { version: '0.1.0' }) }}</p>
            <p class="about-desc">{{ t('settings.aboutDesc') }}</p>
          </div>
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

.about-desc {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}
</style>
