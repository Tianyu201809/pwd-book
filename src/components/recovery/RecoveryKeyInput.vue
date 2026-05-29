<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Eye, EyeOff } from 'lucide-vue-next'
import RecoveryTrustNotice from '@/components/recovery/RecoveryTrustNotice.vue'
import { UiInput, UiButton } from '@/components/ui'
import { formatRecoveryKeyInput } from '@/shared/utils'

defineProps<{
  loading: boolean
  errorMessage: string
  recoveryConfigured: boolean
}>()

const emit = defineEmits<{
  back: []
  submit: [recoveryKey: string]
}>()

const { t } = useI18n()

const recoveryKey = ref('')
const showKey = ref(false)

watch(recoveryKey, (value) => {
  const formatted = formatRecoveryKeyInput(value)
  if (formatted !== value) {
    recoveryKey.value = formatted
  }
})

function submit(): void {
  emit('submit', recoveryKey.value)
}
</script>

<template>
  <div class="recovery-panel">
    <button type="button" class="back-link" @click="emit('back')">{{ t('recovery.back') }}</button>
    <h2 class="panel-title">{{ t('recovery.enterRecoveryKey') }}</h2>
    <RecoveryTrustNotice />

    <label class="label">{{ t('recovery.recoveryKey') }}</label>
    <div class="input-wrap">
      <UiInput
        v-model="recoveryKey"
        :type="showKey ? 'text' : 'password'"
        class="font-mono recovery-input"
        placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
        :disabled="loading"
        @keydown.enter="submit"
      />
      <button type="button" class="eye-btn" @click="showKey = !showKey">
        <EyeOff v-if="showKey" :size="16" :stroke-width="1.5" />
        <Eye v-else :size="16" :stroke-width="1.5" />
      </button>
    </div>

    <p v-if="!recoveryConfigured" class="warn-text">{{ t('recovery.recoveryKeyNotConfigured') }}</p>
    <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

    <UiButton variant="primary" class="submit-btn" block :disabled="loading || !recoveryKey" :loading="loading" @click="submit">
      {{ loading ? t('common.verifying') : t('common.continue') }}
    </UiButton>
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
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
}

.label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.input-wrap {
  position: relative;
}

.recovery-input {
  width: 100%;
}

.eye-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  z-index: 2;
}

.warn-text,
.error-text {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--status-danger);
}

.submit-btn {
  margin-top: 16px;
}
</style>
