<script setup lang="ts">
import { ref } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'
import RecoveryTrustNotice from '@/components/recovery/RecoveryTrustNotice.vue'
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

const recoveryKey = ref('')
const showKey = ref(false)

function onInput(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  recoveryKey.value = formatRecoveryKeyInput(value)
}

function submit(): void {
  emit('submit', recoveryKey.value)
}
</script>

<template>
  <div class="recovery-panel">
    <button type="button" class="back-link" @click="emit('back')">← 返回</button>
    <h2 class="panel-title">输入恢复密钥</h2>
    <RecoveryTrustNotice />

    <label class="label">恢复密钥</label>
    <div class="input-wrap">
      <input
        :value="recoveryKey"
        :type="showKey ? 'text' : 'password'"
        class="input-field font-mono"
        placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
        :disabled="loading"
        @input="onInput"
        @keydown.enter="submit"
      />
      <button type="button" class="eye-btn" @click="showKey = !showKey">
        <EyeOff v-if="showKey" :size="16" :stroke-width="1.5" />
        <Eye v-else :size="16" :stroke-width="1.5" />
      </button>
    </div>

    <p v-if="!recoveryConfigured" class="warn-text">尚未设置恢复密钥，无法通过此方式恢复。</p>
    <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

    <button
      type="button"
      class="btn-primary submit-btn"
      :disabled="loading || !recoveryKey"
      @click="submit"
    >
      {{ loading ? '验证中…' : '验证并继续' }}
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

.input-field {
  padding: 12px 40px 12px 16px;
  font-size: 14px;
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
}

.warn-text {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--status-danger);
}

.error-text {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--status-danger);
}

.submit-btn {
  width: 100%;
  margin-top: 16px;
  padding: 12px;
}
</style>
