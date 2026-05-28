<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronRight, Download, KeyRound, RefreshCw, X } from 'lucide-vue-next'
import RecoveryKeySetup from '@/components/recovery/RecoveryKeySetup.vue'
import { useAppState } from '@/composables/useAppState'

const {
  vaultStatus,
  loading,
  errorMessage,
  clearError,
  createRecoveryKey,
  regenerateRecoveryKey,
  copyUsername,
  exportData,
} = useAppState()

const showPasswordDialog = ref(false)
const showKeySetup = ref(false)
const masterPassword = ref('')
const showMasterPassword = ref(false)
const passwordError = ref('')
const generatedRecoveryKey = ref('')
const statusMessage = ref('')

const recoveryConfigured = computed(() => vaultStatus.value.recoveryConfigured)
const recoveryStatusLabel = computed(() =>
  recoveryConfigured.value ? '已设置' : '未设置',
)
const recoveryStatusClass = computed(() =>
  recoveryConfigured.value ? 'status-ok' : 'status-warn',
)
const setupTitle = computed(() =>
  recoveryConfigured.value ? '新的恢复密钥' : '保存你的恢复密钥',
)
const setupSubtitle = computed(() =>
  recoveryConfigured.value
    ? '旧恢复密钥已失效，请保存新密钥'
    : '忘记主密码时，可用它重置主密码并保留数据',
)
const actionLabel = computed(() =>
  recoveryConfigured.value ? '重新生成恢复密钥' : '设置恢复密钥',
)

function openRecoveryAction(): void {
  clearError()
  passwordError.value = ''
  statusMessage.value = ''
  if (recoveryConfigured.value) {
    masterPassword.value = ''
    showPasswordDialog.value = true
    return
  }
  void startCreateRecoveryKey()
}

async function startCreateRecoveryKey(): Promise<void> {
  clearError()
  passwordError.value = ''
  const key = await createRecoveryKey()
  if (!key) return
  generatedRecoveryKey.value = key
  showKeySetup.value = true
}

async function confirmRegenerate(): Promise<void> {
  passwordError.value = ''
  if (masterPassword.value.length < 4) {
    passwordError.value = '请输入当前主密码'
    return
  }
  const key = await regenerateRecoveryKey(masterPassword.value)
  if (!key) {
    passwordError.value = errorMessage.value || '主密码不正确'
    return
  }
  masterPassword.value = ''
  showPasswordDialog.value = false
  generatedRecoveryKey.value = key
  showKeySetup.value = true
}

function closePasswordDialog(): void {
  showPasswordDialog.value = false
  masterPassword.value = ''
  passwordError.value = ''
  clearError()
}

function closeKeySetup(): void {
  showKeySetup.value = false
  generatedRecoveryKey.value = ''
}

async function handleKeySetupComplete(): Promise<void> {
  closeKeySetup()
  statusMessage.value = '恢复密钥已保存'
}

async function handleCopyRecoveryKey(): Promise<void> {
  if (generatedRecoveryKey.value) {
    await copyUsername(generatedRecoveryKey.value)
  }
}

async function handleExportBackup(): Promise<void> {
  clearError()
  statusMessage.value = ''
  try {
    const json = await exportData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `pwdbook-backup-${Date.now()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    statusMessage.value = 'JSON 备份已导出'
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : '导出失败'
  }
}
</script>

<template>
  <div class="recovery-settings">
    <h4 class="section-title">恢复与应急</h4>
    <p v-if="statusMessage" class="status-message">{{ statusMessage }}</p>
    <div class="surface-card settings-card">
      <div class="row">
        <div>
          <p class="row-title">恢复密钥</p>
          <p class="row-desc">仅创建时可查看明文，关闭后无法再次查看</p>
        </div>
        <span class="status-badge" :class="recoveryStatusClass">{{ recoveryStatusLabel }}</span>
      </div>
      <button type="button" class="link-row" @click="openRecoveryAction">
        <span>
          <component
            :is="recoveryConfigured ? RefreshCw : KeyRound"
            :size="16"
            :stroke-width="1.5"
          />
          {{ actionLabel }}
        </span>
        <ChevronRight :size="16" :stroke-width="1.5" />
      </button>
      <button type="button" class="link-row last" @click="handleExportBackup">
        <span><Download :size="16" :stroke-width="1.5" /> 导出 JSON 备份</span>
        <ChevronRight :size="16" :stroke-width="1.5" />
      </button>
    </div>

    <Teleport to="body">
      <div v-if="showPasswordDialog" class="dialog-overlay" @click.self="closePasswordDialog">
        <div class="dialog surface-card">
          <div class="dialog-header">
            <h4>验证主密码</h4>
            <button type="button" class="close-btn" @click="closePasswordDialog">
              <X :size="16" :stroke-width="1.5" />
            </button>
          </div>
          <p class="dialog-desc">重新生成恢复密钥前，需验证当前主密码。旧密钥将立即失效。</p>
          <label class="field-label">当前主密码</label>
          <div class="input-wrap">
            <input
              v-model="masterPassword"
              :type="showMasterPassword ? 'text' : 'password'"
              class="input-field"
              placeholder="••••••••••••"
              :disabled="loading"
              @keydown.enter="confirmRegenerate"
            />
            <button
              type="button"
              class="eye-btn"
              @click="showMasterPassword = !showMasterPassword"
            >
              {{ showMasterPassword ? '隐藏' : '显示' }}
            </button>
          </div>
          <p v-if="passwordError" class="error-text">{{ passwordError }}</p>
          <button
            type="button"
            class="btn-primary submit-btn"
            :disabled="loading"
            @click="confirmRegenerate"
          >
            {{ loading ? '验证中…' : '继续' }}
          </button>
        </div>
      </div>

      <div v-if="showKeySetup" class="dialog-overlay" @click.self="closeKeySetup">
        <div class="dialog dialog-wide surface-card">
          <RecoveryKeySetup
            :recovery-key="generatedRecoveryKey"
            :loading="loading"
            :error-message="errorMessage"
            :title="setupTitle"
            :subtitle="setupSubtitle"
            @complete="handleKeySetupComplete"
            @skip="closeKeySetup"
            @copy="handleCopyRecoveryKey"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.recovery-settings {
  margin-top: 32px;
}

.section-title {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.status-message {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--status-success);
}

.settings-card {
  overflow: hidden;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-default);
}

.row-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}

.row-desc {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.status-badge {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}

.status-ok {
  background: rgba(52, 211, 153, 0.12);
  color: var(--status-success);
}

.status-warn {
  background: rgba(251, 191, 36, 0.12);
  color: var(--status-warning, #d97706);
}

.link-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border: none;
  border-bottom: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.link-row span {
  display: flex;
  align-items: center;
  gap: 12px;
}

.link-row:hover {
  background: var(--bg-hover);
}

.link-row.last {
  border-bottom: none;
}

.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  padding: 24px;
}

.dialog {
  width: min(400px, calc(100vw - 48px));
  padding: 24px;
}

.dialog-wide {
  width: min(460px, calc(100vw - 48px));
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.dialog-header h4 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}

.dialog-desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.field-label {
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
  width: 100%;
  padding: 12px 56px 12px 16px;
  font-size: 14px;
}

.eye-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
}

.error-text {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--status-danger);
}

.submit-btn {
  width: 100%;
  margin-top: 16px;
  padding: 12px;
}
</style>
