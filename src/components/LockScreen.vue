<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ShieldCheck, Eye, EyeOff } from 'lucide-vue-next'
import RecoveryMenu from '@/components/recovery/RecoveryMenu.vue'
import RecoveryKeyInput from '@/components/recovery/RecoveryKeyInput.vue'
import RecoveryResetPassword from '@/components/recovery/RecoveryResetPassword.vue'
import RecoveryWipe from '@/components/recovery/RecoveryWipe.vue'
import RecoveryKeySetup from '@/components/recovery/RecoveryKeySetup.vue'
import RecoveryProgressOverlay from '@/components/recovery/RecoveryProgressOverlay.vue'
import { UiCard, UiInput, UiButton } from '@/components/ui'
import { useAppState } from '@/composables/useAppState'
import { vaultApi } from '@/services/vaultApi'

type LockMode =
  | 'unlock'
  | 'setup'
  | 'setup-recovery'
  | 'recovery-menu'
  | 'recovery-key'
  | 'recovery-reset'
  | 'recovery-wipe'
  | 'recovery-wipe-confirm'

const {
  vaultStatus,
  setupVault,
  unlock,
  loading,
  errorMessage,
  clearError,
  enterVault,
  refreshVaultStatus,
  createRecoveryKey,
  clearRecoveryKey,
  resetMasterPasswordWithRecovery,
  resetVaultFromLock,
  copyUsername,
} = useAppState()

const { t } = useI18n()

const lockMode = ref<LockMode>('unlock')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const hasError = ref(false)
const verifiedRecoveryKey = ref('')
const generatedRecoveryKey = ref('')
const showProgress = ref(false)
const localMessage = ref('')

const isSetupMode = computed(() => !vaultStatus.value.initialized)
const title = computed(() => {
  if (lockMode.value === 'setup-recovery') return t('lock.saveRecoveryKey')
  if (lockMode.value === 'setup' && !vaultStatus.value.initialized) return t('lock.createMasterPassword')
  if (lockMode.value.startsWith('recovery-')) return t('lock.recoverAccess')
  return t('lock.unlockVault')
})
const submitLabel = computed(() =>
  isSetupMode.value ? t('lock.createAndEnter') : t('lock.unlock'),
)
const showDefaultForm = computed(
  () => lockMode.value === 'unlock' || lockMode.value === 'setup',
)

onMounted(async () => {
  clearError()
  await refreshVaultStatus()
  lockMode.value = vaultStatus.value.initialized ? 'unlock' : 'setup'
})

watch(
  () => vaultStatus.value.initialized,
  (initialized) => {
    if (!initialized && lockMode.value === 'unlock') {
      lockMode.value = 'setup'
      return
    }
    if (initialized && lockMode.value === 'setup') {
      lockMode.value = 'unlock'
    }
  },
)

watch([password, confirmPassword], () => {
  if (errorMessage.value) clearError()
  localMessage.value = ''
})

watch(lockMode, async (mode) => {
  localMessage.value = ''
  if (lockMode.value !== 'recovery-reset') {
    clearError()
  }

  if (mode === 'setup-recovery' && !generatedRecoveryKey.value) {
    const key = await createRecoveryKey()
    if (key) {
      generatedRecoveryKey.value = key
    } else {
      await enterVault()
    }
  }
})

function shakeOnError(): void {
  hasError.value = true
  setTimeout(() => {
    hasError.value = false
  }, 400)
}

async function submitUnlockOrSetup(): Promise<void> {
  if (password.value.length < 4) {
    shakeOnError()
    return
  }

  if (isSetupMode.value) {
    const ok = await setupVault(password.value, confirmPassword.value)
    if (!ok) {
      shakeOnError()
      return
    }
    password.value = ''
    confirmPassword.value = ''
    generatedRecoveryKey.value = ''
    lockMode.value = 'setup-recovery'
    return
  }

  const ok = await unlock(password.value)
  if (ok) {
    password.value = ''
    confirmPassword.value = ''
    return
  }
  shakeOnError()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') submitUnlockOrSetup()
}

function openRecoveryMenu(): void {
  clearError()
  localMessage.value = ''
  lockMode.value = 'recovery-menu'
}

async function handleBackupOption(): Promise<void> {
  localMessage.value = t('lock.backupHint')
}

async function handleRecoveryKeySubmit(recoveryKey: string): Promise<void> {
  if (!vaultStatus.value.recoveryConfigured) return
  clearError()
  try {
    const result = await vaultApi.verifyRecoveryKey(recoveryKey)
    if (!result.valid) {
      localMessage.value = t('errors.recovery_key_invalid')
      return
    }
    verifiedRecoveryKey.value = recoveryKey
    lockMode.value = 'recovery-reset'
  } catch (error) {
    localMessage.value = error instanceof Error ? error.message : t('errors.verify_failed')
  }
}

async function handleRecoveryReset(newPassword: string, confirmPasswordValue: string): Promise<void> {
  if (newPassword.length < 4) {
    localMessage.value = t('errors.master_password_too_short')
    return
  }
  if (newPassword !== confirmPasswordValue) {
    localMessage.value = t('errors.master_password_mismatch')
    return
  }

  showProgress.value = true
  clearError()
  const ok = await resetMasterPasswordWithRecovery(
    verifiedRecoveryKey.value,
    newPassword,
    confirmPasswordValue,
  )
  showProgress.value = false
  if (ok) {
    verifiedRecoveryKey.value = ''
    lockMode.value = 'unlock'
    return
  }
}

async function handleWipeConfirm(): Promise<void> {
  const ok = await resetVaultFromLock()
  if (ok) {
    lockMode.value = 'setup'
    password.value = ''
    confirmPassword.value = ''
  }
}

async function handleSetupRecoveryComplete(): Promise<void> {
  await enterVault()
}

async function handleSetupRecoverySkip(): Promise<void> {
  if (!window.confirm(t('lock.skipRecoveryConfirm'))) {
    return
  }
  await clearRecoveryKey()
  await enterVault()
}

async function handleCopyRecoveryKey(): Promise<void> {
  if (generatedRecoveryKey.value) {
    await copyUsername(generatedRecoveryKey.value)
  }
}
</script>

<template>
  <div class="lock-screen">
    <RecoveryProgressOverlay v-if="showProgress" />

    <div class="lock-content">
      <div class="brand">
        <div class="brand-icon">
          <ShieldCheck
            :size="32"
            :stroke-width="1.5"
          />
        </div>
        <h1 class="font-display">
          {{ t('common.appName') }}
        </h1>
        <p class="subtitle">
          {{ title }}
        </p>
      </div>

      <UiCard class="panel-glow lock-panel">
        <template v-if="showDefaultForm">
          <label class="label">{{ t('lock.masterPassword') }}</label>
          <div class="input-wrap">
            <UiInput
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="lock-input"
              :class="{ shake: hasError }"
              placeholder="••••••••••••"
              :disabled="loading"
              @keydown="onKeydown"
            />
            <button
              type="button"
              class="eye-btn titlebar-no-drag"
              @click="showPassword = !showPassword"
            >
              <EyeOff
                v-if="showPassword"
                :size="16"
                :stroke-width="1.5"
              />
              <Eye
                v-else
                :size="16"
                :stroke-width="1.5"
              />
            </button>
          </div>

          <template v-if="isSetupMode">
            <label class="label confirm-label">{{ t('lock.confirmMasterPassword') }}</label>
            <UiInput
              v-model="confirmPassword"
              :type="showPassword ? 'text' : 'password'"
              class="lock-input"
              :placeholder="t('lock.confirmPlaceholder')"
              :disabled="loading"
              @keydown="onKeydown"
            />
          </template>

          <p
            v-if="errorMessage"
            class="error-text"
          >
            {{ errorMessage }}
          </p>
          <p
            v-if="localMessage"
            class="info-text"
          >
            {{ localMessage }}
          </p>

          <UiButton
            variant="primary"
            class="unlock-btn"
            :disabled="loading"
            block
            @click="submitUnlockOrSetup"
          >
            {{ loading ? t('common.processing') : isSetupMode ? t('common.next') : submitLabel }}
          </UiButton>

          <template v-if="!isSetupMode">
            <div class="recovery-links">
              <button
                type="button"
                class="text-link"
                @click="openRecoveryMenu"
              >
                {{ t('lock.forgotPassword') }}
              </button>
              <button
                type="button"
                class="text-link accent"
                @click="openRecoveryMenu"
              >
                {{ t('lock.useRecoveryKey') }}
              </button>
            </div>
          </template>
        </template>

        <RecoveryKeySetup
          v-else-if="lockMode === 'setup-recovery'"
          :recovery-key="generatedRecoveryKey"
          :loading="loading"
          :error-message="errorMessage"
          @complete="handleSetupRecoveryComplete"
          @skip="handleSetupRecoverySkip"
          @copy="handleCopyRecoveryKey"
        />

        <RecoveryMenu
          v-else-if="lockMode === 'recovery-menu'"
          :entry-count="vaultStatus.entryCount"
          @back="lockMode = 'unlock'"
          @recovery-key="lockMode = 'recovery-key'"
          @backup="handleBackupOption"
          @wipe="lockMode = 'recovery-wipe'"
        />

        <RecoveryKeyInput
          v-else-if="lockMode === 'recovery-key'"
          :loading="loading"
          :error-message="localMessage || errorMessage"
          :recovery-configured="vaultStatus.recoveryConfigured"
          @back="lockMode = 'recovery-menu'"
          @submit="handleRecoveryKeySubmit"
        />

        <RecoveryResetPassword
          v-else-if="lockMode === 'recovery-reset'"
          :loading="loading"
          :error-message="errorMessage || localMessage"
          @back="lockMode = 'recovery-key'"
          @submit="handleRecoveryReset"
        />

        <RecoveryWipe
          v-else-if="lockMode === 'recovery-wipe'"
          mode="info"
          :entry-count="vaultStatus.entryCount"
          :loading="loading"
          :error-message="errorMessage"
          @back="lockMode = 'recovery-menu'"
          @continue="lockMode = 'recovery-wipe-confirm'"
        />

        <RecoveryWipe
          v-else-if="lockMode === 'recovery-wipe-confirm'"
          mode="confirm"
          :entry-count="vaultStatus.entryCount"
          :loading="loading"
          :error-message="errorMessage"
          @back="lockMode = 'recovery-wipe'"
          @confirm="handleWipeConfirm"
        />
      </UiCard>

      <p class="footer-note">
        {{ t('lock.footerNote') }}
      </p>
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

.input-wrap .lock-input {
  padding-right: 40px;
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

.info-text {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.recovery-links {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 16px;
}

.text-link {
  border: none;
  background: transparent;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
}

.text-link:hover {
  color: var(--text-secondary);
}

.text-link.accent {
  color: var(--accent-primary);
}

.text-link.accent:hover {
  opacity: 0.85;
}

.footer-note {
  text-align: center;
  margin-top: 24px;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
