<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { UiLoading, UiCard } from '@/components/ui'

const { t } = useI18n()
</script>

<template>
  <UiLoading :active="true" />
  <div class="progress-overlay">
    <UiCard class="progress-card">
      <p class="progress-title">
        {{ t('recovery.progressTitle') }}
      </p>
      <div class="progress-bar">
        <span class="progress-fill" />
      </div>
      <p class="progress-hint">
        {{ t('recovery.progressHint') }}
      </p>
    </UiCard>
  </div>
</template>

<style scoped>
.progress-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.progress-card {
  width: min(360px, calc(100vw - 48px));
  padding: 28px 24px;
  text-align: center;
}

.progress-title {
  margin: 0 0 20px;
  font-size: 16px;
  font-weight: 600;
}

.progress-bar {
  height: 6px;
  border-radius: 999px;
  background: var(--border-default);
  overflow: hidden;
}

.progress-fill {
  display: block;
  height: 100%;
  width: 40%;
  border-radius: 999px;
  background: var(--accent-primary);
  animation: indeterminate 1.2s ease-in-out infinite;
}

.progress-hint {
  margin: 16px 0 0;
  font-size: 13px;
  color: var(--text-muted);
}

@keyframes indeterminate {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(350%);
  }
}
</style>
