<script setup lang="ts">
import { ref, computed } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'

defineProps<{
  loading: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  back: []
  submit: [newPassword: string, confirmPassword: string]
}>()

const newPassword = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)

const strengthLevel = computed(() => {
  const len = newPassword.value.length
  if (len >= 16) return { label: '强', bars: 3 }
  if (len >= 10) return { label: '中', bars: 2 }
  if (len >= 1) return { label: '弱', bars: 1 }
  return { label: '无', bars: 0 }
})

function submit(): void {
  emit('submit', newPassword.value, confirmPassword.value)
}
</script>

<template>
  <div class="recovery-panel">
    <button type="button" class="back-link" @click="emit('back')">← 返回</button>
    <h2 class="panel-title">设置新主密码</h2>
    <p class="panel-desc">验证通过后，请为保险库设置新的主密码</p>

    <label class="label">新主密码</label>
    <div class="input-wrap">
      <input
        v-model="newPassword"
        :type="showPassword ? 'text' : 'password'"
        class="input-field"
        :disabled="loading"
        @keydown.enter="submit"
      />
      <button type="button" class="eye-btn" @click="showPassword = !showPassword">
        <EyeOff v-if="showPassword" :size="16" :stroke-width="1.5" />
        <Eye v-else :size="16" :stroke-width="1.5" />
      </button>
    </div>

    <label class="label confirm-label">确认新主密码</label>
    <input
      v-model="confirmPassword"
      :type="showPassword ? 'text' : 'password'"
      class="input-field"
      :disabled="loading"
      @keydown.enter="submit"
    />

    <div class="strength">
      <div class="bars">
        <span v-for="i in 4" :key="i" class="bar" :class="{ filled: i <= strengthLevel.bars }" />
      </div>
      <span class="strength-label">{{ strengthLevel.label }}</span>
    </div>

    <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

    <button type="button" class="btn-primary submit-btn" :disabled="loading" @click="submit">
      {{ loading ? '正在重新加密…' : '重置主密码' }}
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
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 600;
}

.panel-desc {
  margin: 0 0 20px;
  font-size: 14px;
  color: var(--text-secondary);
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

.confirm-label {
  margin-top: 16px;
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

.strength {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.bars {
  display: flex;
  gap: 4px;
  flex: 1;
}

.bar {
  flex: 1;
  height: 4px;
  border-radius: 999px;
  background: var(--border-default);
}

.bar.filled {
  background: var(--status-success);
}

.strength-label {
  font-size: 12px;
  color: var(--text-muted);
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
