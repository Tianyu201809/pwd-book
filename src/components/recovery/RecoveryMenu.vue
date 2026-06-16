<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { KeyRound, AlertTriangle } from 'lucide-vue-next'

const { t } = useI18n()

defineProps<{
  entryCount: number
}>()

const emit = defineEmits<{
  back: []
  recoveryKey: []
  wipe: []
}>()
</script>

<template>
  <div class="recovery-panel">
    <button
      type="button"
      class="back-link"
      @click="emit('back')"
    >
      {{ t('recovery.backToUnlock') }}
    </button>
    <h2 class="panel-title">
      {{ t('recovery.cannotUnlock') }}
    </h2>
    <p class="panel-desc">
      {{ t('recovery.chooseOption') }}
    </p>

    <button
      type="button"
      class="option-card"
      @click="emit('recoveryKey')"
    >
      <KeyRound
        :size="20"
        :stroke-width="1.5"
        class="option-icon"
      />
      <div>
        <p class="option-title">
          {{ t('recovery.haveRecoveryKey') }}
        </p>
        <p class="option-desc">
          {{ t('recovery.haveRecoveryKeyDesc') }}
        </p>
      </div>
    </button>

    <button
      type="button"
      class="option-card danger"
      @click="emit('wipe')"
    >
      <AlertTriangle
        :size="20"
        :stroke-width="1.5"
        class="option-icon danger-icon"
      />
      <div>
        <p class="option-title">
          {{ t('recovery.haveNothing') }}
        </p>
        <p class="option-desc">
          {{ t('recovery.haveNothingDesc', { count: entryCount }) }}
        </p>
      </div>
    </button>
  </div>
</template>

<style scoped>
.recovery-panel {
  width: 100%;
}

.back-link {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  margin-bottom: 20px;
}

.back-link:hover {
  color: var(--text-primary);
}

.panel-title {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 600;
}

.panel-desc {
  margin: 0 0 20px;
  font-size: 14px;
  color: var(--text-secondary);
}

.option-card {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 16px;
  margin-bottom: 10px;
  border: 1px solid var(--border-default);
  border-radius: 12px;
  background: var(--bg-elevated);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s, background-color 0.2s;
}

.option-card:hover {
  border-color: var(--border-accent);
  background: var(--bg-hover);
}

.option-card.danger:hover {
  border-color: rgba(248, 113, 113, 0.4);
}

.option-icon {
  color: var(--accent-primary);
  flex-shrink: 0;
  margin-top: 2px;
}

.danger-icon {
  color: var(--status-danger);
}

.option-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 500;
}

.option-desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
