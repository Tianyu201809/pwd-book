<script setup lang="ts">
import { CheckCircle2, XCircle } from 'lucide-vue-next'
import { Card } from 'animal-island-vue'
import { useToast } from '@/composables/useToast'
import { useTheme } from '@/composables/useTheme'

const { toasts } = useToast()
const { isAnimalIsland } = useTheme()
</script>

<template>
  <Teleport to="body">
    <div class="toast-host" aria-live="polite" aria-atomic="true">
      <TransitionGroup name="toast">
        <template v-for="toast in toasts" :key="toast.id">
          <Card
            v-if="isAnimalIsland"
            :color="toast.type === 'success' ? 'app-green' : 'app-red'"
            class="toast-item toast-item--animal"
          >
            <CheckCircle2 v-if="toast.type === 'success'" :size="18" :stroke-width="1.5" />
            <XCircle v-else :size="18" :stroke-width="1.5" />
            <span>{{ toast.message }}</span>
          </Card>
          <div v-else class="toast-item" :class="toast.type">
            <CheckCircle2 v-if="toast.type === 'success'" :size="18" :stroke-width="1.5" />
            <XCircle v-else :size="18" :stroke-width="1.5" />
            <span>{{ toast.message }}</span>
          </div>
        </template>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-host {
  position: fixed;
  top: 48px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10001;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
  width: min(420px, calc(100vw - 32px));
}

.toast-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: fit-content;
  max-width: 100%;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.4;
  box-shadow:
    0 12px 32px rgba(15, 23, 42, 0.16),
    0 0 0 1px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(8px);
}

.toast-item--animal {
  box-shadow: none;
  backdrop-filter: none;
}

.toast-item.success {
  background: rgba(240, 253, 244, 0.96);
  color: #166534;
  border: 1px solid rgba(34, 197, 94, 0.25);
}

.toast-item.error {
  background: rgba(254, 242, 242, 0.96);
  color: #991b1b;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

.toast-move {
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}
</style>
