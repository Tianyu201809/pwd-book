<script setup lang="ts">
import { Loading } from 'animal-island-vue'
import { useTheme } from '@/composables/useTheme'

withDefaults(
  defineProps<{
    active?: boolean
  }>(),
  {
    active: false,
  },
)

const { isAnimalIsland } = useTheme()
</script>

<template>
  <Loading
    v-if="isAnimalIsland"
    :active="active"
  />
  <div
    v-else-if="active"
    class="ui-loading-classic"
  >
    <div class="ui-loading-spinner" />
  </div>
</template>

<style scoped>
.ui-loading-classic {
  position: fixed;
  inset: 0;
  z-index: 9500;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
}

.ui-loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-default);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
