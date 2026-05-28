<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { bindSystemThemeListener, unbindSystemThemeListener } from '@/composables/useTheme'
import { useAppState } from '@/composables/useAppState'
import { useAutoLock } from '@/composables/useAutoLock'
import TitleBar from '@/components/TitleBar.vue'
import LockScreen from '@/components/LockScreen.vue'
import VaultView from '@/components/VaultView.vue'
import SettingsView from '@/components/SettingsView.vue'
import ToastHost from '@/components/ToastHost.vue'

const { screen, bootstrap } = useAppState()

useAutoLock()

onMounted(async () => {
  bindSystemThemeListener()
  await bootstrap()
})

onUnmounted(unbindSystemThemeListener)
</script>

<template>
  <div class="app-root vault-texture">
    <TitleBar />
    <main class="app-main">
      <LockScreen v-if="screen === 'lock'" />
      <VaultView v-else-if="screen === 'vault'" />
      <SettingsView v-else-if="screen === 'settings'" />
    </main>
    <ToastHost />
  </div>
</template>

<style scoped>
.app-root {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
