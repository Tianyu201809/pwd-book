<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronRight, Download, KeyRound, RefreshCw, AlertCircle } from 'lucide-vue-next'
import RecoveryKeySetup from '@/components/recovery/RecoveryKeySetup.vue'
import { UiModal, UiInput, UiButton } from '@/components/ui'
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
  exportDataAsExcel,
} = useAppState()

const { t } = useI18n()

const showPasswordDialog = ref(false)
const showKeySetup = ref(false)
const masterPassword = ref('')
const showMasterPassword = ref(false)
const passwordError = ref('')
const generatedRecoveryKey = ref('')
const statusMessage = ref('')
const showPlainTextConfirm = ref(false)
const pendingPlainTextExport = ref<'json' | 'excel' | null>(null)

const recoveryConfigured = computed(() => vaultStatus.value.recoveryConfigured)
const recoveryStatusLabel = computed(() =>
  recoveryConfigured.value ? t('recovery.configured') : t('recovery.notConfigured'),
)
const recoveryStatusClass = computed(() =>
  recoveryConfigured.value ? 'status-ok' : 'status-warn',
)
const setupTitle = computed(() =>
  recoveryConfigured.value ? t('recovery.newKeyTitle') : t('recovery.saveKeyTitle'),
)
const setupSubtitle = computed(() =>
  recoveryConfigured.value ? t('recovery.newKeySubtitle') : t('recovery.saveKeySubtitle'),
)
const actionLabel = computed(() =>
  recoveryConfigured.value ? t('recovery.regenerateKey') : t('recovery.setupKey'),
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
    passwordError.value = t('lock.enterCurrentPassword')
    return
  }
  const key = await regenerateRecoveryKey(masterPassword.value)
  if (!key) {
    passwordError.value = errorMessage.value || t('errors.master_password_incorrect')
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
  statusMessage.value = t('recovery.keySaved')
}

async function handleCopyRecoveryKey(): Promise<void> {
  if (generatedRecoveryKey.value) {
    await copyUsername(generatedRecoveryKey.value)
  }
}

function requestExportJson(): void {
  clearError()
  statusMessage.value = ''
  pendingPlainTextExport.value = 'json'
  showPlainTextConfirm.value = true
}

function requestExportExcel(): void {
  clearError()
  statusMessage.value = ''
  pendingPlainTextExport.value = 'excel'
  showPlainTextConfirm.value = true
}

function cancelPlainTextConfirm(): void {
  showPlainTextConfirm.value = false
  pendingPlainTextExport.value = null
}

async function confirmPlainTextExport(): Promise<void> {
  const format = pendingPlainTextExport.value
  cancelPlainTextConfirm()
  if (format === 'json') {
    await handleExportJson()
  } else if (format === 'excel') {
    await handleExportExcel()
  }
}

async function handleExportJson(): Promise<void> {
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
    statusMessage.value = t('recovery.jsonExported')
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : t('errors.export_failed')
  }
}

async function handleExportExcel(): Promise<void> {
  clearError()
  statusMessage.value = ''
  try {
    const bytes = await exportDataAsExcel()
    const blob = new Blob([new Uint8Array(bytes)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `pwdbook-backup-${Date.now()}.xlsx`
    anchor.click()
    URL.revokeObjectURL(url)
    statusMessage.value = t('recovery.excelExported')
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : t('errors.export_failed')
  }
}
</script>

<template>
  <div class="recovery-settings">
    <h4 class="section-title">
      {{ t('recovery.sectionTitle') }}
    </h4>
    <p
      v-if="statusMessage"
      class="status-message"
    >
      {{ statusMessage }}
    </p>
    <div class="surface-card settings-card">
      <div class="row">
        <div>
          <p class="row-title">
            {{ t('recovery.recoveryKey') }}
          </p>
          <p class="row-desc">
            {{ t('recovery.recoveryKeyDesc') }}
          </p>
        </div>
        <span
          class="status-badge"
          :class="recoveryStatusClass"
        >{{ recoveryStatusLabel }}</span>
      </div>
      <button
        type="button"
        class="link-row"
        @click="openRecoveryAction"
      >
        <span>
          <component
            :is="recoveryConfigured ? RefreshCw : KeyRound"
            :size="16"
            :stroke-width="1.5"
          />
          {{ actionLabel }}
        </span>
        <ChevronRight
          :size="16"
          :stroke-width="1.5"
        />
      </button>
      <button
        type="button"
        class="link-row"
        @click="requestExportJson"
      >
        <span><Download
          :size="16"
          :stroke-width="1.5"
        /> {{ t('recovery.exportJson') }}</span>
        <ChevronRight
          :size="16"
          :stroke-width="1.5"
        />
      </button>
      <button
        type="button"
        class="link-row last"
        @click="requestExportExcel"
      >
        <span><Download
          :size="16"
          :stroke-width="1.5"
        /> {{ t('recovery.exportExcel') }}</span>
        <ChevronRight
          :size="16"
          :stroke-width="1.5"
        />
      </button>
    </div>

    <UiModal
      v-model:open="showPasswordDialog"
      :title="t('recovery.verifyPassword')"
      :width="420"
      :show-footer="false"
      @close="closePasswordDialog"
    >
      <p class="dialog-desc">
        {{ t('recovery.verifyPasswordDesc') }}
      </p>
      <label class="field-label">{{ t('recovery.currentPassword') }}</label>
      <div class="input-wrap">
        <UiInput
          v-model="masterPassword"
          :type="showMasterPassword ? 'text' : 'password'"
          placeholder="••••••••••••"
          :disabled="loading"
          @keydown.enter="confirmRegenerate"
        />
        <button
          type="button"
          class="eye-btn"
          @click="showMasterPassword = !showMasterPassword"
        >
          {{ showMasterPassword ? t('common.hide') : t('common.show') }}
        </button>
      </div>
      <p
        v-if="passwordError"
        class="error-text"
      >
        {{ passwordError }}
      </p>
      <UiButton
        variant="primary"
        class="submit-btn"
        block
        :disabled="loading"
        :loading="loading"
        @click="confirmRegenerate"
      >
        {{ loading ? t('common.verifying') : t('common.continue') }}
      </UiButton>
    </UiModal>

    <UiModal
      v-model:open="showKeySetup"
      :show-footer="false"
      :width="480"
      :mask-closable="true"
      @close="closeKeySetup"
    >
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
    </UiModal>

    <UiModal
      v-model:open="showPlainTextConfirm"
      :title="t('export.plainTextConfirmTitle')"
      :width="400"
      :show-footer="false"
      @close="cancelPlainTextConfirm"
    >
      <p class="confirm-modal-body plain-text-confirm-text">
        <AlertCircle
          :size="16"
          :stroke-width="1.5"
          class="plain-text-confirm-icon"
        />
        {{ t('export.plainTextConfirmBody') }}
      </p>
      <template #footer>
        <div class="confirm-modal-actions">
          <UiButton
            variant="default"
            @click="cancelPlainTextConfirm"
          >
            {{ t('common.cancel') }}
          </UiButton>
          <UiButton
            variant="primary"
            @click="confirmPlainTextExport"
          >
            <Download
              :size="16"
              :stroke-width="1.5"
            />
            {{ t('export.confirmExport') }}
          </UiButton>
        </div>
      </template>
    </UiModal>
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

.confirm-modal-body {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}

.plain-text-confirm-text {
  color: var(--text-secondary);
}

.plain-text-confirm-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--status-danger);
}

.confirm-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}
</style>
