<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ShieldCheck, Eye, EyeOff, Fingerprint } from 'lucide-vue-next'
import { useAppState } from '@/composables/useAppState'

const {
  vaultStatus,
  setupVault,
  unlock,
  loading,
  errorMessage,
  clearError,
} = useAppState()

const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const hasError = ref(false)

const isSetupMode = computed(() => !vaultStatus.value.initialized)
const title = computed(() => (isSetupMode.value ? '创建主密码' : '输入主密码以解锁保险库'))
const submitLabel = computed(() => (isSetupMode.value ? '创建并进入' : '解锁'))

onMounted(async () => {
  clearError()
})

watch([password, confirmPassword], () => {
  if (errorMessage.value) clearError()
})

async function submit(): Promise<void> {
  if (password.value.length < 4) {
    hasError.value = true
    setTimeout(() => {
      hasError.value = false
    }, 400)
    return
  }

  const ok = isSetupMode.value
    ? await setupVault(password.value, confirmPassword.value)
    : await unlock(password.value)

  if (ok) {
    password.value = ''
    confirmPassword.value = ''
    hasError.value = false
    return
  }

  hasError.value = true
  setTimeout(() => {
    hasError.value = false
  }, 400)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') submit()
}
</script>

<template>
  <div class="lock-screen">
    <div class="lock-content">
      <div class="brand">
        <div class="brand-icon">
          <ShieldCheck :size="32" :stroke-width="1.5" />
        </div>
        <h1 class="font-display">PwdBook</h1>
        <p class="subtitle">{{ title }}</p>
      </div>

      <div class="panel-glow lock-panel surface-card">
        <label class="label">主密码</label>
        <div class="input-wrap">
          <input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            class="input-field"
            :class="{ shake: hasError }"
            placeholder="••••••••••••"
            :disabled="loading"
            @keydown="onKeydown"
          />
          <button type="button" class="eye-btn" @click="showPassword = !showPassword">
            <EyeOff v-if="showPassword" :size="16" :stroke-width="1.5" />
            <Eye v-else :size="16" :stroke-width="1.5" />
          </button>
        </div>

        <template v-if="isSetupMode">
          <label class="label confirm-label">确认主密码</label>
          <input
            v-model="confirmPassword"
            :type="showPassword ? 'text' : 'password'"
            class="input-field"
            placeholder="再次输入主密码"
            :disabled="loading"
            @keydown="onKeydown"
          />
        </template>

        <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

        <button type="button" class="btn-primary unlock-btn" :disabled="loading" @click="submit">
          {{ loading ? '处理中…' : submitLabel }}
        </button>

        <div v-if="!isSetupMode" class="divider-row">
          <span class="line" />
          <span class="or">或</span>
          <span class="line" />
        </div>

        <button v-if="!isSetupMode" type="button" class="btn-ghost hello-btn" disabled>
          <Fingerprint :size="16" :stroke-width="1.5" class="safe-icon" />
          Windows Hello（即将支持）
        </button>
      </div>

      <p class="footer-note">数据仅存储在本地 · AES-256 加密 · SQLite 存储</p>
    </div>
  </div>
</template>

<style scoped>
.lock-screen {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lock-content {
  width: 100%;
  max-width: 420px;
  padding: 0 32px;
}

.brand {
  text-align: center;
  margin-bottom: 40px;
}

.brand-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: var(--accent-subtle);
  border: 1px solid var(--border-accent);
  color: var(--accent-primary);
}

h1 {
  font-size: 30px;
  letter-spacing: -0.02em;
  margin: 0 0 8px;
}

.subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.lock-panel {
  padding: 24px;
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
  border-radius: 8px;
}

.unlock-btn {
  width: 100%;
  margin-top: 16px;
  padding: 12px;
  font-size: 14px;
}

.unlock-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-text {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--status-danger);
}

.divider-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0;
}

.line {
  flex: 1;
  height: 1px;
  background: var(--border-default);
}

.or {
  font-size: 12px;
  color: var(--text-muted);
}

.hello-btn {
  width: 100%;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
}

.hello-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.safe-icon {
  color: var(--status-safe);
}

.footer-note {
  text-align: center;
  margin-top: 24px;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
