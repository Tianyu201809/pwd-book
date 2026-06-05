<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Cursor } from 'animal-island-vue'
import { bindSystemThemeListener, unbindSystemThemeListener, useTheme } from '@/composables/useTheme'
import { useAppState } from '@/composables/useAppState'
import { useAutoLock } from '@/composables/useAutoLock'
import { showToast } from '@/composables/useToast'
import { parseErrorMessage } from '@/shared/utils'
import TitleBar from '@/components/TitleBar.vue'
import LockScreen from '@/components/LockScreen.vue'
import VaultView from '@/components/VaultView.vue'
import SettingsView from '@/components/SettingsView.vue'
import EmailBackupView from '@/components/EmailBackupView.vue'
import PasswordGenView from '@/components/PasswordGenView.vue'
import TrashView from '@/components/TrashView.vue'
import MasterPasswordConfirmModal from '@/components/MasterPasswordConfirmModal.vue'
import ToastHost from '@/components/ToastHost.vue'
import AnimalBackdrop from '@/components/AnimalBackdrop.vue'
import { initScreenshotBridge } from '@/composables/useScreenshotBridge'

const { t } = useI18n()
const { isAnimalIsland } = useTheme()
const {
  screen,
  bootstrap,
  scheduledBackupPromptOpen,
  openScheduledBackupPrompt,
  closeScheduledBackupPrompt,
  sendEmailBackup,
} = useAppState()

useAutoLock()

let removeAlreadyRunningListener: (() => void) | undefined
let removeScheduledBackupListener: (() => void) | undefined
const scheduledBackupLoading = ref(false)
const scheduledMasterModalRef = ref<InstanceType<typeof MasterPasswordConfirmModal> | null>(null)

onMounted(async () => {
  bindSystemThemeListener()
  if (window.electronAPI?.isScreenshotMode?.()) {
    initScreenshotBridge()
  }
  removeAlreadyRunningListener = window.electronAPI?.onAlreadyRunning(() => {
    showToast(t('common.alreadyRunning'), 'success')
  })
  removeScheduledBackupListener = window.electronAPI?.onScheduledBackupDue(() => {
    openScheduledBackupPrompt()
  })
  await bootstrap()
})

onUnmounted(() => {
  unbindSystemThemeListener()
  removeAlreadyRunningListener?.()
  removeScheduledBackupListener?.()
})

async function confirmScheduledBackup(masterPassword: string): Promise<void> {
  scheduledBackupLoading.value = true
  try {
    await sendEmailBackup(masterPassword)
    showToast(t('tools.emailBackup.sent'), 'success')
    closeScheduledBackupPrompt()
    scheduledMasterModalRef.value?.resetPassword()
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  } finally {
    scheduledBackupLoading.value = false
  }
}
</script>

<template>
  <Cursor v-if="isAnimalIsland">
    <div class="app-root app-root--animal vault-texture">
      <AnimalBackdrop />
      <TitleBar class="app-chrome" />
      <main class="app-main app-chrome">
        <LockScreen v-if="screen === 'lock'" />
        <VaultView v-else-if="screen === 'vault'" />
        <SettingsView v-else-if="screen === 'settings'" />
        <EmailBackupView v-else-if="screen === 'email-backup'" />
        <PasswordGenView v-else-if="screen === 'password-gen'" />
        <TrashView v-else-if="screen === 'trash'" />
      </main>
      <MasterPasswordConfirmModal
        ref="scheduledMasterModalRef"
        v-model:open="scheduledBackupPromptOpen"
        :title="t('tools.emailBackup.scheduledPromptTitle')"
        :description="t('tools.emailBackup.scheduledPromptDesc')"
        :confirm-label="t('tools.emailBackup.confirmBackup')"
        :loading="scheduledBackupLoading"
        @close="closeScheduledBackupPrompt"
        @confirm="confirmScheduledBackup"
      />
      <ToastHost />
    </div>
  </Cursor>
  <div v-else class="app-root vault-texture">
    <TitleBar />
    <main class="app-main">
      <LockScreen v-if="screen === 'lock'" />
      <VaultView v-else-if="screen === 'vault'" />
      <SettingsView v-else-if="screen === 'settings'" />
      <EmailBackupView v-else-if="screen === 'email-backup'" />
      <PasswordGenView v-else-if="screen === 'password-gen'" />
      <TrashView v-else-if="screen === 'trash'" />
    </main>
    <MasterPasswordConfirmModal
      ref="scheduledMasterModalRef"
      v-model:open="scheduledBackupPromptOpen"
      :title="t('tools.emailBackup.scheduledPromptTitle')"
      :description="t('tools.emailBackup.scheduledPromptDesc')"
      :confirm-label="t('tools.emailBackup.confirmBackup')"
      :loading="scheduledBackupLoading"
      @close="closeScheduledBackupPrompt"
      @confirm="confirmScheduledBackup"
    />
    <ToastHost />
  </div>
</template>

<style scoped>
.app-root {
  position: relative;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.app-chrome {
  position: relative;
  z-index: 1;
}

.app-main {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 各主屏（保险库/设置等）占满剩余高度，内部才能滚动 */
.app-main > * {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
</style>
