<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookOpen, Globe, KeyRound, PlugZap, ShieldCheck } from 'lucide-vue-next'
import { UiButton, UiCard, UiInput, UiSwitch } from '@/components/ui'
import BrowserExtensionGuideModal from '@/components/browser/BrowserExtensionGuideModal.vue'
import { useAppState } from '@/composables/useAppState'
import { useToast } from '@/composables/useToast'
import { vaultApi } from '@/services/vaultApi'
import type { BrowserBridgeStatus, NativeHostRegistrationInfo } from '@/shared/browserBridgeProtocol'
import { parseErrorMessage } from '@/shared/utils'

const { t } = useI18n()
const { securitySettings, updateSecuritySettings, clearError } = useAppState()
const { showToast } = useToast()

const bridgeStatus = ref<BrowserBridgeStatus | null>(null)
const nativeHostInfo = ref<NativeHostRegistrationInfo | null>(null)
const extensionIdInput = ref('')
const registerLoading = ref(false)
const browserGuideOpen = ref(false)
const extensionsPageHint = ref('')
const setupMessage = ref('')

const fillEnabled = computed(() => securitySettings.value.browserFillEnabled)

const bridgeStatusText = computed(() => {
  const status = bridgeStatus.value
  if (!status?.enabled) return t('settings.browserFillStatusStopped')
  if (!status.unlocked) return t('settings.browserFillStatusLocked')
  if (status.running && status.port) return t('settings.browserFillStatusRunning', { port: status.port })
  return t('settings.browserFillStatusStopped')
})

const registrationLabel = computed(() => {
  if (nativeHostInfo.value?.registered) {
    return t('settings.browserFillRegistered', { id: nativeHostInfo.value.extensionId })
  }
  if (nativeHostInfo.value && !nativeHostInfo.value.hostCmdExists) {
    return t('settings.browserFillHostMissing')
  }
  return t('settings.browserFillNotRegistered')
})

async function onBrowserFillEnabledChange(enabled: boolean): Promise<void> {
  await updateSecuritySettings({ browserFillEnabled: enabled })
  await refreshBridgeStatus()
}

async function refreshBridgeStatus(): Promise<void> {
  try {
    bridgeStatus.value = await vaultApi.getBrowserBridgeStatus()
  } catch {
    bridgeStatus.value = null
  }
}

async function refreshNativeHostInfo(): Promise<void> {
  try {
    nativeHostInfo.value = await vaultApi.getNativeHostRegistrationInfo()
    if (nativeHostInfo.value.extensionId && !extensionIdInput.value) {
      extensionIdInput.value = nativeHostInfo.value.extensionId
    }
  } catch {
    nativeHostInfo.value = null
  }
}

async function registerNativeHost(): Promise<void> {
  clearError()
  registerLoading.value = true
  try {
    nativeHostInfo.value = await vaultApi.registerNativeHost(extensionIdInput.value)
    setupMessage.value = t('settings.browserFillRegisterSuccess')
    showToast(t('settings.browserFillRegisterSuccess'), 'success')
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  } finally {
    registerLoading.value = false
  }
}

async function openExtensionsPage(): Promise<void> {
  try {
    const { copiedUrl } = await vaultApi.openExtensionsPage()
    extensionsPageHint.value = t('settings.browserFillOpenExtensionsDone', { url: copiedUrl })
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  }
}

async function openExtensionDir(): Promise<void> {
  try {
    await vaultApi.openExtensionDir()
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  }
}

async function regenerateBridgeToken(): Promise<void> {
  try {
    bridgeStatus.value = await vaultApi.regenerateBrowserBridgeToken()
    setupMessage.value = t('settings.browserFillRegenerateDone')
    showToast(t('settings.browserFillRegenerateDone'), 'success')
  } catch (error) {
    showToast(error instanceof Error ? error.message : String(error), 'error')
  }
}

onMounted(() => {
  void refreshBridgeStatus()
  void refreshNativeHostInfo()
})

watch(fillEnabled, () => {
  void refreshBridgeStatus()
})
</script>

<template>
  <div
    class="browser-settings"
    data-tour="settings-browser"
  >
    <header class="browser-hero">
      <div class="browser-hero-mark">
        <Globe
          :size="22"
          :stroke-width="1.6"
        />
      </div>
      <div class="browser-hero-copy">
        <p class="browser-kicker">{{ t('settings.browserTab') }}</p>
        <h3 class="font-display browser-title">
          {{ t('settings.browserModuleTitle') }}
        </h3>
        <p class="browser-lead">
          {{ t('settings.browserModuleLead') }}
        </p>
      </div>
      <div class="browser-hero-aside">
        <UiButton
          variant="default"
          size="small"
          @click="browserGuideOpen = true"
        >
          <BookOpen
            :size="14"
            :stroke-width="1.75"
          />
          {{ t('settings.browserFillGuide.openButton') }}
        </UiButton>
      </div>
    </header>

    <UiCard class="settings-card power-card">
      <div class="power-row">
        <div class="power-copy">
          <p
            class="power-status"
            :class="{ on: fillEnabled }"
          >
            {{ fillEnabled ? t('settings.browserStatusOn') : t('settings.browserStatusOff') }}
          </p>
          <p class="row-title">
            {{ t('settings.browserFill') }}
          </p>
          <p class="row-desc">
            {{ t('settings.browserFillDesc') }}
          </p>
        </div>
        <UiSwitch
          :model-value="fillEnabled"
          @update:model-value="onBrowserFillEnabledChange"
        />
      </div>
    </UiCard>

    <div
      class="policy-strip"
      :class="{ dormant: !fillEnabled }"
    >
      <div class="policy-chip">
        <PlugZap
          :size="14"
          :stroke-width="1.75"
        />
        <div>
          <span>{{ t('settings.browserPolicyBridge') }}</span>
          <strong>{{ bridgeStatusText }}</strong>
        </div>
      </div>
      <div class="policy-chip">
        <ShieldCheck
          :size="14"
          :stroke-width="1.75"
        />
        <div>
          <span>{{ t('settings.browserPolicyLink') }}</span>
          <strong>{{ nativeHostInfo?.registered ? t('settings.browserLinked') : t('settings.browserFillNotRegistered') }}</strong>
        </div>
      </div>
      <div class="policy-chip">
        <KeyRound
          :size="14"
          :stroke-width="1.75"
        />
        <div>
          <span>{{ t('settings.browserPolicyScope') }}</span>
          <strong>{{ t('settings.browserLocalOnly') }}</strong>
        </div>
      </div>
    </div>

    <section :class="{ dormant: !fillEnabled }">
      <h4>{{ t('settings.browserSetupTitle') }}</h4>
      <UiCard class="settings-card">
        <div class="setup-block">
          <p class="setup-title">
            {{ t('settings.browserFillSetupTitle') }}
          </p>
          <ol class="setup-steps">
            <li>
              <span class="setup-step-index">1</span>
              <div>
                <p class="setup-step-title">{{ t('settings.browserFillSetupLoadTitle') }}</p>
                <p class="row-desc">{{ t('settings.browserFillSetupLoadDesc') }}</p>
              </div>
            </li>
            <li>
              <span class="setup-step-index">2</span>
              <div>
                <p class="setup-step-title">{{ t('settings.browserFillSetupIdTitle') }}</p>
                <p class="row-desc">{{ t('settings.browserFillSetupIdDesc') }}</p>
              </div>
            </li>
            <li>
              <span class="setup-step-index">3</span>
              <div>
                <p class="setup-step-title">{{ t('settings.browserFillSetupRestartTitle') }}</p>
                <p class="row-desc">{{ t('settings.browserFillSetupRestartDesc') }}</p>
              </div>
            </li>
          </ol>
          <p
            class="row-desc registration-status"
            :class="{
              'is-ok': nativeHostInfo?.registered,
              'is-warn': nativeHostInfo && !nativeHostInfo.registered && !nativeHostInfo.hostCmdExists,
            }"
          >
            {{ registrationLabel }}
          </p>
          <label class="setup-label">{{ t('settings.browserFillExtensionId') }}</label>
          <UiInput
            v-model="extensionIdInput"
            class="setup-input"
            :placeholder="t('settings.browserFillExtensionIdPlaceholder')"
            allow-clear
          />
          <div class="setup-actions">
            <UiButton
              variant="primary"
              size="small"
              :disabled="!extensionIdInput.trim() || registerLoading"
              @click="registerNativeHost"
            >
              {{ t('settings.browserFillRegister') }}
            </UiButton>
            <UiButton
              variant="default"
              size="small"
              @click="openExtensionDir"
            >
              {{ t('settings.browserFillOpenExtensionDir') }}
            </UiButton>
            <UiButton
              v-if="fillEnabled"
              variant="default"
              size="small"
              @click="regenerateBridgeToken"
            >
              {{ t('settings.browserFillRegenerateToken') }}
            </UiButton>
          </div>
          <p
            v-if="setupMessage"
            class="setup-message"
          >
            {{ setupMessage }}
          </p>
          <p
            v-if="extensionsPageHint"
            class="extensions-page-hint"
          >
            {{ extensionsPageHint }}
          </p>
        </div>
      </UiCard>
    </section>

    <BrowserExtensionGuideModal
      v-model:open="browserGuideOpen"
      :extension-id="extensionIdInput"
      :registered="!!nativeHostInfo?.registered"
      :bridge-enabled="fillEnabled"
      :register-loading="registerLoading"
      :extensions-page-hint="extensionsPageHint"
      @update:extension-id="extensionIdInput = $event"
      @open-extensions="openExtensionsPage"
      @register="registerNativeHost"
    />
  </div>
</template>

<style scoped>
.browser-settings {
  max-width: 680px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.browser-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 18px;
  align-items: start;
  padding: 22px 22px 20px;
  overflow: hidden;
  border: 1px solid var(--border-default);
  border-radius: 16px;
  background:
    radial-gradient(ellipse 90% 140% at -8% 0%, rgba(2, 132, 199, 0.16), transparent 56%),
    linear-gradient(180deg, color-mix(in srgb, #0284c7 8%, var(--bg-surface)) 0%, var(--bg-surface) 72%);
  box-shadow: var(--titlebar-shadow, none);
}

.browser-hero-mark {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  color: #0ea5e9;
  background: rgba(2, 132, 199, 0.14);
  box-shadow: inset 0 0 0 1px rgba(2, 132, 199, 0.28);
}

.browser-kicker {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #0ea5e9;
}

.browser-title {
  margin: 0;
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.browser-lead {
  max-width: 40em;
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.browser-hero-aside {
  display: flex;
  align-items: center;
}

.power-card {
  overflow: hidden;
  border-color: color-mix(in srgb, #0284c7 22%, var(--border-default));
}

.power-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
}

.power-status {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.power-status.on {
  color: var(--status-success);
}

.policy-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.policy-chip {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 72px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  background: color-mix(in srgb, var(--bg-surface) 88%, var(--bg-elevated));
  color: #0ea5e9;
}

.policy-chip div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.policy-chip span {
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.policy-chip strong {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.35;
}

h4 {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.settings-card {
  overflow: hidden;
}

.setup-block {
  padding: 18px 20px 20px;
}

.setup-title {
  margin: 0 0 14px;
  font-size: 14px;
  font-weight: 600;
}

.setup-steps {
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.setup-steps li {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 12px;
  position: relative;
  padding-bottom: 14px;
}

.setup-steps li:last-child {
  padding-bottom: 0;
}

.setup-steps li:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 10px;
  top: 24px;
  bottom: 2px;
  width: 1px;
  background: color-mix(in srgb, #0284c7 28%, var(--border-default));
}

.setup-step-index {
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #0ea5e9;
  background: rgba(2, 132, 199, 0.12);
  box-shadow: inset 0 0 0 1px rgba(2, 132, 199, 0.28);
}

.setup-step-title {
  margin: 2px 0 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.registration-status {
  margin-top: 2px;
}

.row-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}

.row-desc {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-muted);
}

.row-desc.is-ok {
  color: var(--status-success);
}

.row-desc.is-warn {
  color: var(--status-danger);
}

.setup-label {
  display: block;
  margin: 14px 0 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.setup-input {
  width: 100%;
  max-width: 420px;
}

.setup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.setup-message {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--status-success);
}

.extensions-page-hint {
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  line-height: 1.55;
  color: var(--status-success);
  background: color-mix(in srgb, var(--status-success) 10%, var(--bg-elevated));
  border: 1px solid color-mix(in srgb, var(--status-success) 25%, transparent);
}

.dormant {
  opacity: 0.55;
}

@media (max-width: 720px) {
  .browser-hero {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .browser-hero-aside {
    grid-column: 1 / -1;
  }

  .policy-strip {
    grid-template-columns: 1fr;
  }
}
</style>
