<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getWipeConfirmPhrase } from '@/i18n'
import { UiInput, UiButton } from '@/components/ui'

defineProps<{
  entryCount: number
  loading: boolean
  errorMessage: string
  mode: 'info' | 'confirm'
}>()

const emit = defineEmits<{
  back: []
  continue: []
  confirm: []
}>()

const { t } = useI18n()

const confirmText = ref('')
const confirmPhrase = computed(() => getWipeConfirmPhrase())

function submitConfirm(): void {
  if (confirmText.value.trim() === confirmPhrase.value) {
    emit('confirm')
  }
}
</script>

<template>
  <div class="recovery-panel">
    <button type="button" class="back-link" @click="emit('back')">{{ t('recovery.back') }}</button>

    <template v-if="mode === 'info'">
      <h2 class="panel-title">{{ t('recovery.wipeTitle') }}</h2>
      <div class="danger-box">
        <p class="danger-title">{{ t('recovery.wipeDanger') }}</p>
        <p class="danger-desc">{{ t('recovery.wipeDesc', { count: entryCount }) }}</p>
        <p class="danger-hint">{{ t('recovery.wipeHint') }}</p>
      </div>
      <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
      <UiButton variant="ghost" class="danger-btn" block @click="emit('continue')">
        {{ t('recovery.wipeContinue') }}
      </UiButton>
    </template>

    <template v-else>
      <h2 class="panel-title">{{ t('recovery.wipeFinalTitle') }}</h2>
      <p class="panel-desc">{{ t('recovery.wipeFinalDesc') }}</p>
      <p class="confirm-phrase">{{ confirmPhrase }}</p>
      <UiInput
        v-model="confirmText"
        class="wipe-input"
        :placeholder="t('recovery.wipeConfirmPlaceholder')"
        :disabled="loading"
        @keydown.enter="submitConfirm"
      />
      <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
      <UiButton
        variant="danger"
        class="danger-submit"
        block
        :disabled="loading || confirmText.trim() !== confirmPhrase"
        :loading="loading"
        @click="submitConfirm"
      >
        {{ loading ? t('recovery.wiping') : t('recovery.wipeSubmit') }}
      </UiButton>
    </template>
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

.panel-title {
  margin: 0 0 12px;
  font-size: 18px;
  font-weight: 600;
}

.panel-desc {
  margin: 0 0 12px;
  font-size: 14px;
  color: var(--text-secondary);
}

.danger-box {
  padding: 14px 16px;
  border-radius: 12px;
  border: 1px solid rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.06);
  margin-bottom: 16px;
}

.danger-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--status-danger);
}

.danger-desc,
.danger-hint {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.danger-hint {
  margin-bottom: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.confirm-phrase {
  margin: 0 0 12px;
  padding: 10px;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  background: var(--accent-subtle);
  color: var(--accent-primary);
}

.wipe-input {
  width: 100%;
}

.error-text {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--status-danger);
}

.danger-btn {
  width: 100%;
  padding: 12px;
  color: var(--status-danger);
}

.danger-submit {
  width: 100%;
  margin-top: 16px;
  padding: 12px;
  background: var(--status-danger);
}

.danger-submit:disabled {
  opacity: 0.5;
}
</style>
