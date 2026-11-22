<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowLeft,
  MailCheck,
  Shield,
  Send,
  Loader2,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from 'lucide-vue-next'
import MasterPasswordConfirmModal from '@/components/MasterPasswordConfirmModal.vue'
import { UiInput, UiButton, UiCheckbox } from '@/components/ui'
import { useAppState } from '@/composables/useAppState'
import { showToast } from '@/composables/useToast'
import { parseErrorMessage } from '@/shared/utils'
import type { EmailBackupSettingsUpdate } from '@/shared/types'
import type { BackupFrequency } from '@/types'

const props = withDefaults(defineProps<{ embedded?: boolean }>(), {
  embedded: false,
})

const {
  navigateTo,
  emailBackupSettings,
  loadEmailBackupSettings,
  updateEmailBackupSettings,
  testEmailBackupConnection,
  sendEmailBackup,
} = useAppState()

const { t, locale } = useI18n()

const recipientEmail = ref('')
const frequency = ref<BackupFrequency>('manual')
const smtpHost = ref('')
const smtpPort = ref(465)
const smtpSecure = ref(true)
const smtpUsername = ref('')
const smtpPassword = ref('')
const smtpPasswordEdited = ref(false)
const showSmtpPassword = ref(false)
const SAVED_SMTP_PASSWORD_MASK = '********'
const smtpExpanded = ref(true)

const smtpPasswordModel = computed({
  get() {
    if (smtpPasswordEdited.value || smtpPassword.value) return smtpPassword.value
    if (emailBackupSettings.value.smtp.hasPassword) return SAVED_SMTP_PASSWORD_MASK
    return ''
  },
  set(value: string) {
    if (
      !smtpPasswordEdited.value &&
      emailBackupSettings.value.smtp.hasPassword &&
      value === SAVED_SMTP_PASSWORD_MASK
    ) {
      return
    }
    smtpPasswordEdited.value = true
    smtpPassword.value = value
  },
})

const settingsLoaded = ref(false)
const autosaveStatus = ref<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle')
const autosaveError = ref('')
const testing = ref(false)
const backingUp = ref(false)
const backupSuccess = ref(false)
const showMasterModal = ref(false)
const masterModalRef = ref<InstanceType<typeof MasterPasswordConfirmModal> | null>(null)
const AUTO_SAVE_DELAY_MS = 600
let autosaveTimer: ReturnType<typeof setTimeout> | null = null
let saveInFlight: Promise<boolean> | null = null
let syncingSettings = false
let passwordFocused = false
let changeVersion = 0
let savedVersion = 0

const frequencyOptions = computed(() => [
  { id: 'manual' as BackupFrequency, label: t('tools.emailBackup.frequencyManual') },
  { id: 'weekly' as BackupFrequency, label: t('tools.emailBackup.frequencyWeekly') },
  { id: 'monthly' as BackupFrequency, label: t('tools.emailBackup.frequencyMonthly') },
])

const lastBackupText = computed(() => {
  const last = emailBackupSettings.value.lastBackup
  if (!last.at) return t('tools.emailBackup.lastBackupNever')
  const date = new Date(last.at).toLocaleDateString(locale.value === 'zh-CN' ? 'zh-CN' : 'en-US')
  const sizeKb = `${Math.max(1, Math.round(last.sizeBytes / 1024))} KB`
  return t('tools.emailBackup.lastBackupMeta', {
    date,
    count: last.entryCount,
    size: sizeKb,
  })
})

const statusLabel = computed(() => {
  const status = emailBackupSettings.value.lastBackup.status
  if (status === 'success') return t('tools.emailBackup.statusSuccess')
  if (status === 'failed') return t('tools.emailBackup.statusFailed')
  return ''
})

function syncFromSettings(): void {
  const settings = emailBackupSettings.value
  recipientEmail.value = settings.recipientEmail
  frequency.value = settings.frequency
  smtpHost.value = settings.smtp.host
  smtpPort.value = settings.smtp.port
  smtpSecure.value = settings.smtp.secure
  smtpUsername.value = settings.smtp.username
  smtpPassword.value = ''
  smtpPasswordEdited.value = false
  showSmtpPassword.value = false
}

function onSmtpPasswordFocus(): void {
  passwordFocused = true
  if (!smtpPasswordEdited.value && emailBackupSettings.value.smtp.hasPassword) {
    smtpPasswordEdited.value = true
    smtpPassword.value = ''
  }
}

function onSmtpPasswordBlur(): void {
  passwordFocused = false
  if (!smtpPassword.value) smtpPasswordEdited.value = false
}

onMounted(async () => {
  syncingSettings = true
  await loadEmailBackupSettings()
  syncFromSettings()
  await nextTick()
  syncingSettings = false
  settingsLoaded.value = true
})

function clearAutosaveTimer(): void {
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = null
}

function queueAutosave(): void {
  clearAutosaveTimer()
  autosaveStatus.value = 'pending'
  autosaveError.value = ''
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null
    void saveSettings()
  }, AUTO_SAVE_DELAY_MS)
}

function scheduleAutosave(): void {
  if (!settingsLoaded.value || syncingSettings) return
  changeVersion += 1
  queueAutosave()
}

function buildSettingsUpdate(): EmailBackupSettingsUpdate {
  return {
    recipientEmail: recipientEmail.value,
    frequency: frequency.value,
    smtp: {
      host: smtpHost.value,
      port: Number(smtpPort.value),
      secure: smtpSecure.value,
      username: smtpUsername.value,
      password: smtpPassword.value || undefined,
    },
  }
}

watch(
  [recipientEmail, frequency, smtpHost, smtpPort, smtpSecure, smtpUsername],
  scheduleAutosave,
)

watch(smtpPassword, () => {
  if (smtpPasswordEdited.value && smtpPassword.value) scheduleAutosave()
})

async function saveSettings(): Promise<boolean> {
  clearAutosaveTimer()
  if (saveInFlight && !(await saveInFlight)) return false
  if (changeVersion === savedVersion) return true

  const version = changeVersion
  autosaveStatus.value = 'saving'
  autosaveError.value = ''
  const request = (async () => {
    try {
      await updateEmailBackupSettings(buildSettingsUpdate())
      savedVersion = version
      const latestValuesSaved = changeVersion === version
      autosaveStatus.value = latestValuesSaved ? 'saved' : 'pending'
      if (latestValuesSaved && !passwordFocused && smtpPasswordEdited.value) {
        smtpPassword.value = ''
        smtpPasswordEdited.value = false
        showSmtpPassword.value = false
      }
      return true
    } catch (error) {
      autosaveStatus.value = 'error'
      autosaveError.value = parseErrorMessage(error)
      return false
    }
  })()
  saveInFlight = request
  const saved = await request
  if (saveInFlight === request) saveInFlight = null
  return saved
}

onBeforeUnmount(() => {
  if (!autosaveTimer) return
  clearAutosaveTimer()
  void saveSettings()
})

async function handleTestConnection(): Promise<void> {
  const saved = await saveSettings()
  if (!saved) return
  testing.value = true
  try {
    await testEmailBackupConnection()
    showToast(t('tools.emailBackup.testSuccess'), 'success')
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  } finally {
    testing.value = false
  }
}

function handleBackupNow(): void {
  showMasterModal.value = true
}

async function confirmBackup(masterPassword: string): Promise<void> {
  const saved = await saveSettings()
  if (!saved) return

  backingUp.value = true
  backupSuccess.value = false
  try {
    await sendEmailBackup(masterPassword)
    backupSuccess.value = true
    showToast(t('tools.emailBackup.sent'), 'success')
    showMasterModal.value = false
    masterModalRef.value?.resetPassword()
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  } finally {
    backingUp.value = false
  }
}

function goBack(): void {
  navigateTo('settings', 'security')
}
</script>

<template>
  <div
    class="tool-page-view"
    :class="{ 'tool-page-view--embedded': props.embedded }"
  >
    <div class="tool-page-body">
      <aside
        v-if="!props.embedded"
        class="tool-page-sidebar"
      >
        <button
          type="button"
          class="tool-back-btn"
          @click="goBack"
        >
          <ArrowLeft
            :size="16"
            :stroke-width="1.5"
          />
          {{ t('settings.backToSettings') }}
        </button>
        <div class="tool-sidebar-hero">
          <div class="tool-hero-icon tool-hero-icon--mail">
            <MailCheck
              :size="24"
              :stroke-width="1.5"
            />
          </div>
          <h2 class="tool-sidebar-title font-display">
            {{ t('tools.emailBackup.title') }}
          </h2>
          <p class="tool-sidebar-desc">
            {{ t('tools.emailBackup.subtitle') }}
          </p>
        </div>
      </aside>

      <component
        :is="props.embedded ? 'section' : 'main'"
        class="tool-page-main"
      >
        <div class="tool-page-content">
          <header
            v-if="props.embedded"
            class="email-backup-heading"
          >
            <h3>{{ t('tools.emailBackup.title') }}</h3>
            <p>{{ t('tools.emailBackup.subtitle') }}</p>
          </header>
          <section class="panel-glow surface-card backup-panel">
            <div class="field">
              <label>{{ t('tools.emailBackup.recipientEmail') }}</label>
              <UiInput
                v-model="recipientEmail"
                type="email"
                :placeholder="t('tools.emailBackup.recipientPlaceholder')"
              />
            </div>

            <div class="field">
              <label>{{ t('tools.emailBackup.frequency') }}</label>
              <div class="frequency-grid">
                <button
                  v-for="option in frequencyOptions"
                  :key="option.id"
                  type="button"
                  class="gen-option frequency-btn"
                  :class="{ 'gen-option-active': frequency === option.id }"
                  @click="frequency = option.id"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>

            <div class="smtp-section">
              <button
                type="button"
                class="smtp-toggle"
                @click="smtpExpanded = !smtpExpanded"
              >
                <span>{{ t('tools.emailBackup.smtpSection') }}</span>
                <ChevronUp
                  v-if="smtpExpanded"
                  :size="16"
                  :stroke-width="1.5"
                />
                <ChevronDown
                  v-else
                  :size="16"
                  :stroke-width="1.5"
                />
              </button>
              <div
                v-show="smtpExpanded"
                class="smtp-fields"
              >
                <div class="field">
                  <label>{{ t('tools.emailBackup.smtpHost') }}</label>
                  <UiInput
                    v-model="smtpHost"
                    placeholder="smtp.example.com"
                  />
                </div>
                <div class="field-row">
                  <div class="field flex-1">
                    <label>{{ t('tools.emailBackup.smtpPort') }}</label>
                    <UiInput
                      :model-value="String(smtpPort)"
                      type="text"
                      @update:model-value="(v) => (smtpPort = Number(v) || 465)"
                    />
                  </div>
                  <UiCheckbox
                    v-model="smtpSecure"
                    :label="t('tools.emailBackup.smtpSecure')"
                    class="secure-toggle"
                  />
                </div>
                <div class="field">
                  <label>{{ t('tools.emailBackup.smtpUsername') }}</label>
                  <UiInput
                    v-model="smtpUsername"
                    type="email"
                  />
                </div>
                <div
                  class="field"
                  @focusin="onSmtpPasswordFocus"
                  @focusout="onSmtpPasswordBlur"
                >
                  <label>{{ t('tools.emailBackup.smtpPassword') }}</label>
                  <div class="password-input-wrap">
                    <UiInput
                      v-model="smtpPasswordModel"
                      :type="showSmtpPassword ? 'text' : 'password'"
                      class="password-input"
                      :placeholder="t('tools.emailBackup.smtpPasswordPlaceholder')"
                    />
                    <button
                      type="button"
                      class="eye-btn"
                      :title="showSmtpPassword ? t('common.hide') : t('common.show')"
                      :aria-label="showSmtpPassword ? t('common.hide') : t('common.show')"
                      @click="showSmtpPassword = !showSmtpPassword"
                    >
                      <EyeOff
                        v-if="showSmtpPassword"
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
                </div>
                <p class="smtp-hint">
                  {{ t('tools.emailBackup.smtpHint') }}
                </p>
              </div>
            </div>

            <p
              v-if="autosaveStatus !== 'idle'"
              class="autosave-status"
              :class="{
                'autosave-status--saved': autosaveStatus === 'saved',
                'autosave-status--error': autosaveStatus === 'error',
              }"
              role="status"
              aria-live="polite"
            >
              {{ autosaveStatus === 'error' ? autosaveError : t(autosaveStatus === 'saved' ? 'tools.emailBackup.settingsSaved' : 'tools.emailBackup.settingsSaving') }}
            </p>

            <div class="info-card">
              <Shield
                :size="16"
                :stroke-width="1.5"
              />
              <div>
                <p class="info-title">
                  {{ t('tools.emailBackup.e2eTitle') }}
                </p>
                <p class="info-desc">
                  {{ t('tools.emailBackup.e2eDesc') }}
                </p>
                <p class="info-hint">
                  {{ t('tools.emailBackup.zipExtractHint') }}
                </p>
              </div>
            </div>

            <div class="last-backup-row">
              <div>
                <p class="last-title">
                  {{ t('tools.emailBackup.lastBackup') }}
                </p>
                <p class="last-meta">
                  {{ lastBackupText }}
                </p>
              </div>
              <span
                v-if="emailBackupSettings.lastBackup.status === 'success'"
                class="status-badge success"
              >
                {{ statusLabel }}
              </span>
              <span
                v-else-if="emailBackupSettings.lastBackup.status === 'failed'"
                class="status-badge failed"
              >
                {{ statusLabel }}
              </span>
            </div>
          </section>

          <div class="action-row">
            <UiButton
              variant="primary"
              class="action-btn"
              :disabled="backingUp"
              :loading="backingUp"
              @click="handleBackupNow"
            >
              <template #icon>
                <Loader2
                  v-if="backingUp"
                  :size="16"
                  :stroke-width="1.5"
                  class="spin"
                />
                <Check
                  v-else-if="backupSuccess"
                  :size="16"
                  :stroke-width="1.5"
                />
                <Send
                  v-else
                  :size="16"
                  :stroke-width="1.5"
                />
              </template>
              {{
                backingUp
                  ? t('tools.emailBackup.sending')
                  : backupSuccess
                    ? t('tools.emailBackup.sent')
                    : t('tools.emailBackup.backupNow')
              }}
            </UiButton>
            <UiButton
              variant="ghost"
              class="action-btn"
              :disabled="testing"
              :loading="testing"
              @click="handleTestConnection"
            >
              {{ t('tools.emailBackup.testConnection') }}
            </UiButton>
          </div>
        </div>
      </component>
    </div>

    <MasterPasswordConfirmModal
      ref="masterModalRef"
      v-model:open="showMasterModal"
      :title="t('tools.emailBackup.masterPasswordTitle')"
      :description="t('tools.emailBackup.masterPasswordDesc')"
      :confirm-label="t('tools.emailBackup.confirmBackup')"
      :loading="backingUp"
      @close="showMasterModal = false"
      @confirm="confirmBackup"
    />
  </div>
</template>

<style scoped>
.tool-page-view--embedded {
  height: auto;
}

.tool-page-view--embedded .tool-page-body {
  display: block;
  overflow: visible;
}

.tool-page-view--embedded .tool-page-main {
  overflow: visible;
  padding: 0;
}

.tool-page-view--embedded .tool-page-content {
  max-width: 760px;
}

.email-backup-heading {
  margin-bottom: 20px;
}

.email-backup-heading h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 650;
}

.email-backup-heading p {
  margin: 5px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.autosave-status {
  min-height: 16px;
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
}

.autosave-status--saved {
  color: var(--status-success);
}

.autosave-status--error {
  color: var(--status-danger);
}

.tool-sidebar-hero {
  padding: 0 8px;
}

.backup-panel {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.field label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.flex-1 {
  flex: 1;
}

.secure-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.frequency-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.frequency-btn {
  padding: 8px 12px;
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 500;
}

.smtp-section {
  border-top: 1px solid var(--border-default);
  padding-top: 16px;
}

.smtp-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  padding: 0 0 12px;
}

.smtp-fields {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.password-input-wrap {
  position: relative;
}

.password-input-wrap :deep(.input-field),
.password-input-wrap :deep(input) {
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

.eye-btn:hover {
  color: var(--text-primary);
}

.smtp-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.info-card {
  display: flex;
  gap: 12px;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  background: rgba(45, 212, 191, 0.06);
  border: 1px solid rgba(45, 212, 191, 0.18);
  color: var(--status-safe);
}

.info-title {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
}

.info-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.info-hint {
  margin: 8px 0 0;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.4;
}

.last-backup-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.last-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}

.last-meta {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.status-badge {
  font-size: 10px;
  padding: 4px 8px;
  border-radius: 999px;
  font-weight: 500;
  flex-shrink: 0;
}

.status-badge.success {
  background: rgba(52, 211, 153, 0.12);
  color: var(--status-success);
}

.status-badge.failed {
  background: rgba(248, 113, 113, 0.12);
  color: var(--status-danger);
}

.action-row {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  font-size: 14px;
}
</style>
