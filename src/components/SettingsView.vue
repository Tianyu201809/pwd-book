<script setup lang="ts">
import { computed, ref } from 'vue'
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

const statusMessage = ref('')

const tabs: { id: SettingsTab; label: string; icon: typeof Shield }[] = [
  { id: 'security', label: '安全', icon: Shield },
  { id: 'appearance', label: '外观', icon: Palette },
  { id: 'data', label: '数据', icon: Database },
  { id: 'about', label: '关于', icon: Info },
]

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
    statusMessage.value = '备份已导出'
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : '导出失败'
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
      statusMessage.value = `成功导入 ${count} 条记录`
    } catch (error) {
      statusMessage.value = error instanceof Error ? error.message : '导入失败'
    }
  }
  input.click()
}

async function handleReset(): Promise<void> {
  if (
    !window.confirm('这将清除所有本地密码数据和主密码设置，且不可恢复。确定继续吗？')
  ) {
    return
  }
  await resetAllData()
  statusMessage.value = '所有数据已清除，请重新创建主密码'
}
</script>

<template>
  <div class="settings-view">
    <div class="settings-body">
      <aside class="settings-sidebar">
        <button type="button" class="back-btn" @click="navigateTo('vault')">
          <ArrowLeft :size="16" :stroke-width="1.5" />
          返回
        </button>
        <h2 class="font-display sidebar-title">设置</h2>
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
          <h3>安全</h3>
          <div class="surface-card settings-card">
            <div class="row">
              <div>
                <p class="row-title">自动锁定</p>
                <p class="row-desc">无操作后自动锁定应用</p>
              </div>
              <select
                class="select"
                :value="securitySettings.autoLockMinutes"
                @change="onAutoLockChange"
              >
                <option v-for="minutes in autoLockOptions" :key="minutes" :value="minutes">
                  {{ minutes }} 分钟
                </option>
              </select>
            </div>
            <div class="row">
              <div>
                <p class="row-title">剪贴板自动清除</p>
                <p class="row-desc">
                  复制密码后 {{ securitySettings.clipboardClearSeconds }} 秒清除
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
            <div class="row last">
              <div>
                <p class="row-title">Windows Hello</p>
                <p class="row-desc">使用生物识别快速解锁</p>
              </div>
              <div class="toggle disabled"><span class="knob" /></div>
            </div>
          </div>
        </div>

        <AppearancePanel v-else-if="activeTab === 'appearance'" />

        <div v-else-if="activeTab === 'data'" class="panel">
          <h3>数据</h3>
          <p v-if="statusMessage" class="status-message">{{ statusMessage }}</p>
          <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
          <div class="surface-card settings-card">
            <button type="button" class="link-row" @click="handleExport">
              <span><Download :size="16" :stroke-width="1.5" /> 导出备份</span>
              <ChevronRight :size="16" :stroke-width="1.5" />
            </button>
            <button type="button" class="link-row" @click="handleImport">
              <span><Upload :size="16" :stroke-width="1.5" /> 导入数据</span>
              <ChevronRight :size="16" :stroke-width="1.5" />
            </button>
            <button type="button" class="link-row danger-row" @click="handleReset">
              <span><AlertTriangle :size="16" :stroke-width="1.5" /> 清除所有数据</span>
              <ChevronRight :size="16" :stroke-width="1.5" />
            </button>
          </div>
        </div>

        <div v-else-if="activeTab === 'about'" class="panel">
          <h3>关于</h3>
          <div class="surface-card about-card">
            <p class="font-display about-title">PwdBook</p>
            <p class="about-version">版本 0.1.0 · Electron + Vue 3 + SQLite</p>
            <p class="about-desc">
              本地优先的密码管理工具。密码字段 AES-256 加密存储，元数据保存在本地 SQLite 数据库中。
            </p>
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
