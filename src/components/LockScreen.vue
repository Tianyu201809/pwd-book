<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { Eye, EyeOff } from 'lucide-vue-next'
import appIcon from '@/assets/images/brand/app-icon.png'
import RecoveryMenu from '@/components/recovery/RecoveryMenu.vue'
import RecoveryKeyInput from '@/components/recovery/RecoveryKeyInput.vue'
import RecoveryResetPassword from '@/components/recovery/RecoveryResetPassword.vue'
import RecoveryWipe from '@/components/recovery/RecoveryWipe.vue'
import RecoveryKeySetup from '@/components/recovery/RecoveryKeySetup.vue'
import RecoveryProgressOverlay from '@/components/recovery/RecoveryProgressOverlay.vue'
import { UiCard, UiInput, UiButton } from '@/components/ui'
import { useAppState } from '@/composables/useAppState'
import { vaultApi } from '@/services/vaultApi'
import { lockScreenMode } from '@/components/lockScreenMode'

type LockMode =
  | 'credentials'
  | 'setup-recovery'
  | 'recovery-menu'
  | 'recovery-key'
  | 'recovery-reset'
  | 'recovery-wipe'
  | 'recovery-wipe-confirm'

const {
  bootState,
  vaultStatus,
  setupVault,
  createAccount,
  selectAccount,
  rebuildVault,
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

const lockMode = ref<LockMode>('credentials')
const creatingAccount = ref(false)
const accountName = ref('')
const passwordWrapRef = ref<HTMLElement | null>(null)
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const hasError = ref(false)
const verifiedRecoveryKey = ref('')
const generatedRecoveryKey = ref('')
const showProgress = ref(false)
const localMessage = ref('')

const accountMode = computed(() => lockScreenMode({
  accountCount: bootState.value.accounts.length,
  initialized: vaultStatus.value.initialized,
  creatingAccount: creatingAccount.value,
}))
const asksForAccountName = computed(
  () => accountMode.value === 'boot-empty' || accountMode.value === 'create-account',
)
const asksForConfirm = computed(
  () => asksForAccountName.value || accountMode.value === 'setup-password',
)
const vaultNeedsRebuild = computed(() =>
  bootState.value.vaultFile !== 'ready'
  && accountMode.value !== 'boot-empty'
  && accountMode.value !== 'create-account',
)
const title = computed(() => {
  if (lockMode.value === 'setup-recovery') return t('lock.saveRecoveryKey')
  if (lockMode.value.startsWith('recovery-')) return t('lock.recoverAccess')
  if (vaultNeedsRebuild.value) return t('account.vaultDamaged')
  if (asksForAccountName.value) return t('account.newAccount')
  if (accountMode.value === 'setup-password') return t('lock.createMasterPassword')
  return t('lock.unlockVault')
})
const submitLabel = computed(() =>
  asksForConfirm.value ? t('lock.createAndEnter') : t('lock.unlock'),
)
const showDefaultForm = computed(() => lockMode.value === 'credentials')

onMounted(async () => {
  clearError()
  if (bootState.value.vaultFile === 'ready' && bootState.value.accounts.length > 0) {
    await refreshVaultStatus()
  }
})

watch([password, confirmPassword, accountName], () => {
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

function focusPasswordField(): void {
  void nextTick(() => {
    const input = passwordWrapRef.value?.querySelector('input') as HTMLInputElement | null
    if (!input) return
    // Submitting disables the button, which blurs the focused control. Put the
    // caret back after the error is rendered so typing can continue.
    globalThis.window?.focus?.()
    input.focus()
  })
}

function startCreateAccount(): void {
  creatingAccount.value = true
  accountName.value = ''
  password.value = ''
  confirmPassword.value = ''
  clearError()
  localMessage.value = ''
}

function cancelCreateAccount(): void {
  creatingAccount.value = false
  accountName.value = ''
  password.value = ''
  confirmPassword.value = ''
  clearError()
}

async function chooseAccount(accountId: string): Promise<void> {
  if (loading.value || accountId === bootState.value.activeAccountId) return
  await selectAccount(accountId)
  password.value = ''
  confirmPassword.value = ''
}

async function submitRebuild(): Promise<void> {
  if (loading.value) return
  const ok = await rebuildVault()
  if (!ok) {
    shakeOnError()
    return
  }
  creatingAccount.value = false
  password.value = ''
  confirmPassword.value = ''
}

async function submitUnlockOrSetup(): Promise<void> {
  if (loading.value || vaultNeedsRebuild.value) return

  if (asksForAccountName.value) {
    const ok = await createAccount(accountName.value, password.value, confirmPassword.value)
    if (!ok) {
      shakeOnError()
      focusPasswordField()
      return
    }
    accountName.value = ''
    password.value = ''
    confirmPassword.value = ''
    creatingAccount.value = false
    generatedRecoveryKey.value = ''
    lockMode.value = 'setup-recovery'
    return
  }

  if (password.value.length < 4) {
    shakeOnError()
    focusPasswordField()
    return
  }

  if (accountMode.value === 'setup-password') {
    const ok = await setupVault(password.value, confirmPassword.value)
    if (!ok) {
      shakeOnError()
      focusPasswordField()
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
  focusPasswordField()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter') submitUnlockOrSetup()
}

function openRecoveryMenu(): void {
  clearError()
  localMessage.value = ''
  lockMode.value = 'recovery-menu'
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
    lockMode.value = 'credentials'
    return
  }
}

async function handleWipeConfirm(): Promise<void> {
  const ok = await resetVaultFromLock()
  if (ok) {
    lockMode.value = 'credentials'
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
        <img
          class="brand-icon"
          :src="appIcon"
          alt=""
          width="64"
          height="64"
        >
        <h1 class="font-display">
          {{ t('common.appName') }}
        </h1>
        <p class="subtitle">
          {{ title }}
        </p>
      </div>

      <UiCard class="panel-glow lock-panel">
        <template v-if="showDefaultForm">
          <template v-if="accountMode !== 'boot-empty' && accountMode !== 'create-account'">
            <div class="account-list">
              <button
                v-for="account in bootState.accounts"
                :key="account.id"
                type="button"
                class="account-btn"
                :class="{ 'account-btn--selected': account.id === bootState.activeAccountId }"
                :aria-pressed="account.id === bootState.activeAccountId"
                @click="chooseAccount(account.id)"
              >
                {{ account.name }}
              </button>
            </div>
            <button
              v-if="accountMode === 'unlock' && !vaultNeedsRebuild"
              type="button"
              class="text-link account-create-link"
              @click="startCreateAccount"
            >
              {{ t('account.newAccount') }}
            </button>
          </template>

          <template v-if="vaultNeedsRebuild">
            <p class="error-text">
              {{ t('account.vaultDamaged') }}
            </p>
            <p
              v-if="bootState.quarantinedPath"
              class="info-text"
            >
              {{ bootState.quarantinedPath }}
            </p>
            <UiButton
              variant="primary"
              class="unlock-btn"
              :disabled="loading"
              block
              @click="submitRebuild"
            >
              {{ loading ? t('common.processing') : t('account.rebuildEmpty') }}
            </UiButton>
          </template>

          <template v-else>
            <template v-if="asksForAccountName">
              <label class="label">{{ t('account.name') }}</label>
              <UiInput
                v-model="accountName"
                class="lock-input"
                :placeholder="t('account.name')"
                @keydown="onKeydown"
              />
            </template>

            <label
              class="label"
              :class="{ 'confirm-label': asksForAccountName }"
            >{{ t('lock.masterPassword') }}</label>
            <div
              ref="passwordWrapRef"
              class="input-wrap"
            >
              <UiInput
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                class="lock-input"
                :class="{ shake: hasError }"
                placeholder="••••••••••••"
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

            <template v-if="asksForConfirm">
              <label class="label confirm-label">{{ t('lock.confirmMasterPassword') }}</label>
              <UiInput
                v-model="confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                class="lock-input"
                :placeholder="t('lock.confirmPlaceholder')"
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
              {{ loading ? t('common.processing') : asksForConfirm ? t('common.next') : submitLabel }}
            </UiButton>

            <template v-if="accountMode === 'unlock'">
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

            <button
              v-if="accountMode === 'create-account'"
              type="button"
              class="text-link account-create-link"
              @click="cancelCreateAccount"
            >
              {{ t('common.back') }}
            </button>
          </template>

          <p
            v-if="bootState.warning === 'delete-incomplete'"
            class="info-text"
          >
            {{ t('account.deleteIncomplete') }}
          </p>
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
          @back="lockMode = 'credentials'"
          @recovery-key="lockMode = 'recovery-key'"
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
  display: block;
  margin: 0 auto 24px;
  border-radius: 15px;
  box-shadow: var(--shadow-popover);
  user-select: none;
  -webkit-user-drag: none;
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

.account-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.account-btn {
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  cursor: pointer;
}

.account-btn:hover {
  background: var(--bg-hover);
}

.account-btn--selected {
  border-color: var(--accent-primary);
  background: var(--accent-subtle);
  color: var(--accent-primary);
}

.account-create-link {
  display: inline-block;
  margin: 8px 0 16px;
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
  word-break: break-all;
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
