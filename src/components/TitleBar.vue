<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ShieldCheck, Minus, Square, X } from 'lucide-vue-next'
import { UiModal, UiButton, UiCheckbox } from '@/components/ui'
import { useAppState } from '@/composables/useAppState'
import type { CloseWindowAction } from '@/shared/types'

const { t } = useI18n()
const { securitySettings, updateSecuritySettings } = useAppState()

const showCloseDialog = ref(false)
const rememberChoice = ref(false)

let removeClosePromptListener: (() => void) | undefined

function minimize(): void {
  window.electronAPI?.minimize()
}

function maximize(): void {
  window.electronAPI?.maximize()
}

function applyCloseAction(action: CloseWindowAction): void {
  if (action === 'tray') {
    minimize()
    return
  }
  if (action === 'quit') {
    window.electronAPI?.close()
  }
}

function openCloseDialog(): void {
  const saved = securitySettings.value.closeWindowAction
  if (saved !== 'ask') {
    applyCloseAction(saved)
    return
  }
  rememberChoice.value = false
  showCloseDialog.value = true
}

function dismissCloseDialog(): void {
  showCloseDialog.value = false
  rememberChoice.value = false
}

async function minimizeFromDialog(): Promise<void> {
  showCloseDialog.value = false
  if (rememberChoice.value) {
    await updateSecuritySettings({ closeWindowAction: 'tray' })
  }
  rememberChoice.value = false
  minimize()
}

async function quitApp(): Promise<void> {
  showCloseDialog.value = false
  if (rememberChoice.value) {
    await updateSecuritySettings({ closeWindowAction: 'quit' })
  }
  rememberChoice.value = false
  window.electronAPI?.close()
}

onMounted(() => {
  removeClosePromptListener = window.electronAPI?.onClosePrompt(() => openCloseDialog())
})

onUnmounted(() => {
  removeClosePromptListener?.()
})
</script>

<template>
  <header class="titlebar titlebar-drag">
    <div class="titlebar-left">
      <ShieldCheck class="icon-accent titlebar-no-drag" :size="14" :stroke-width="1.5" />
      <span class="title">{{ t('common.appName') }}</span>
    </div>
    <div class="titlebar-actions titlebar-no-drag">
      <button type="button" class="win-btn" :aria-label="t('titlebar.minimize')" @click="minimize">
        <Minus :size="14" :stroke-width="1.5" />
      </button>
      <button type="button" class="win-btn" :aria-label="t('titlebar.maximize')" @click="maximize">
        <Square :size="12" :stroke-width="1.5" />
      </button>
      <button type="button" class="win-btn close-btn" :aria-label="t('common.close')" @click="openCloseDialog">
        <X :size="14" :stroke-width="1.5" />
      </button>
    </div>
  </header>

  <UiModal v-model:open="showCloseDialog" :title="t('titlebar.closeApp')" :width="400" :show-footer="false" @close="dismissCloseDialog">
    <p class="dialog-desc">{{ t('titlebar.closePrompt') }}</p>
    <UiCheckbox v-model="rememberChoice" :label="t('titlebar.rememberChoice')" class="remember-row" />
    <div class="dialog-actions">
      <UiButton variant="ghost" class="dialog-btn" @click="dismissCloseDialog">{{ t('common.cancel') }}</UiButton>
      <UiButton variant="ghost" class="dialog-btn" @click="minimizeFromDialog">{{ t('titlebar.minimize') }}</UiButton>
      <UiButton variant="primary" class="dialog-btn" @click="quitApp">{{ t('titlebar.quit') }}</UiButton>
    </div>
  </UiModal>
</template>

<style scoped>
.titlebar {
  height: var(--titlebar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}

.titlebar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-accent {
  color: var(--accent-primary);
}

.title {
  font-size: 12px;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.titlebar-actions {
  display: flex;
  gap: 4px;
}

.win-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}

.win-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.close-btn:hover {
  background: var(--status-danger);
  color: #fff;
}

.dialog-desc {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.remember-row {
  margin: 0 0 20px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.dialog-btn {
  padding: 8px 16px;
  font-size: 13px;
}
</style>
