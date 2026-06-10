<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { Cursor } from 'animal-island-vue'
import TitleBar from '@/components/TitleBar.vue'
import PasswordDetail from '@/components/PasswordDetail.vue'
import ToastHost from '@/components/ToastHost.vue'
import AnimalBackdrop from '@/components/AnimalBackdrop.vue'
import { useTheme } from '@/composables/useTheme'
import { useAppState } from '@/composables/useAppState'

const { isAnimalIsland } = useTheme()
const { bootstrap, refreshVaultData, selectedEntryId, isCreating, touchActivity } = useAppState()

let removeSelectListener: (() => void) | undefined
let removeVaultDataListener: (() => void) | undefined

async function applyDetailSelection(entryId: string): Promise<void> {
  isCreating.value = false
  selectedEntryId.value = entryId
  touchActivity()
  await refreshVaultData()
}

watch(selectedEntryId, (id) => {
  if (!id && !isCreating.value) {
    window.electronAPI?.closeDetailWindow?.()
  }
})

removeSelectListener = window.electronAPI?.onDetailWindowSelectEntry?.((entryId) => {
  void applyDetailSelection(entryId)
})

onMounted(async () => {
  await bootstrap()
  removeVaultDataListener = window.electronAPI?.onVaultDataChanged?.(() => {
    void refreshVaultData()
  })
  window.electronAPI?.notifyDetailWindowReady?.()
})

onUnmounted(() => {
  removeSelectListener?.()
  removeVaultDataListener?.()
})
</script>

<template>
  <Cursor v-if="isAnimalIsland">
    <div class="detail-window-root detail-window-root--animal vault-texture">
      <AnimalBackdrop />
      <TitleBar
        class="detail-window-chrome"
        detail-window
      />
      <main class="detail-window-main detail-window-chrome">
        <PasswordDetail detached />
      </main>
      <ToastHost />
    </div>
  </Cursor>
  <div
    v-else
    class="detail-window-root vault-texture"
  >
    <TitleBar detail-window />
    <main class="detail-window-main">
      <PasswordDetail detached />
    </main>
    <ToastHost />
  </div>
</template>

<style scoped>
.detail-window-root {
  position: relative;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.detail-window-chrome {
  position: relative;
  z-index: 1;
}

.detail-window-main {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  display: flex;
  overflow: hidden;
}
</style>
