<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Clipboard, Clock3, HardDrive, Layers } from 'lucide-vue-next'
import { UiButton, UiCard, UiSelect, UiSwitch } from '@/components/ui'
import { useAppState } from '@/composables/useAppState'
import { CLIPBOARD_HISTORY_LIMITS } from '@/shared/clipboardHistoryLimit'

const CLIPBOARD_SESSION_STORAGE_KEY = 'pwdbook-clipboard-session'
const CLIPBOARD_PERSISTENT_STORAGE_KEY = 'pwdbook-clipboard-history'
const clipboardExpiryOptions = [30, 300, 900, 1800, 0] as const

const { t } = useI18n()
const { securitySettings, updateSecuritySettings, openClipboard } = useAppState()

const historyEnabled = computed(() => securitySettings.value.clipboardEnabled)

const clipboardExpirySelectOptions = computed(() => [
  { value: '30', label: t('settings.clipboardExpiry30s') },
  { value: '300', label: t('settings.clipboardExpiry5m') },
  { value: '900', label: t('settings.clipboardExpiry15m') },
  { value: '1800', label: t('settings.clipboardExpiry30m') },
  { value: '0', label: t('settings.clipboardExpiryNever') },
])

const clipboardHistoryLimitSelectOptions = computed(() =>
  CLIPBOARD_HISTORY_LIMITS.map((n) => ({
    value: String(n),
    label: t('settings.clipboardHistoryLimitOption', { n }),
  })),
)

const expiryLabel = computed(() => {
  const expiry = securitySettings.value.clipboardDefaultExpiry
  const match = clipboardExpirySelectOptions.value.find((option) => option.value === String(expiry))
  return match?.label ?? t('settings.clipboardExpiry5m')
})

async function onClipboardEnabledChange(enabled: boolean): Promise<void> {
  await updateSecuritySettings({ clipboardEnabled: enabled })
}

async function onClipboardDefaultExpiryChange(value: string): Promise<void> {
  const expiry = Number(value)
  if ((clipboardExpiryOptions as readonly number[]).includes(expiry)) {
    await updateSecuritySettings({ clipboardDefaultExpiry: expiry as typeof clipboardExpiryOptions[number] })
  }
}

async function onClipboardHistoryLimitChange(value: string): Promise<void> {
  const limit = Number(value)
  if ((CLIPBOARD_HISTORY_LIMITS as readonly number[]).includes(limit)) {
    await updateSecuritySettings({
      clipboardHistoryLimit: limit as (typeof CLIPBOARD_HISTORY_LIMITS)[number],
    })
  }
}

async function onClipboardPersistenceChange(enabled: boolean): Promise<void> {
  await updateSecuritySettings({ clipboardPersistence: enabled })
  if (enabled) {
    const sessionHistory = sessionStorage.getItem(CLIPBOARD_SESSION_STORAGE_KEY)
    if (sessionHistory) localStorage.setItem(CLIPBOARD_PERSISTENT_STORAGE_KEY, sessionHistory)
  } else {
    localStorage.removeItem(CLIPBOARD_PERSISTENT_STORAGE_KEY)
  }
}
</script>

<template>
  <div
    class="clipboard-settings"
    data-tour="settings-clipboard"
  >
    <header class="clipboard-hero">
      <div class="clipboard-hero-mark">
        <Clipboard
          :size="22"
          :stroke-width="1.6"
        />
      </div>
      <div class="clipboard-hero-copy">
        <p class="clipboard-kicker">{{ t('settings.clipboardTab') }}</p>
        <h3 class="font-display clipboard-title">
          {{ t('settings.clipboardModuleTitle') }}
        </h3>
        <p class="clipboard-lead">
          {{ t('settings.clipboardModuleLead') }}
        </p>
      </div>
      <div class="clipboard-hero-aside">
        <span class="clipboard-shortcut">{{ t('tools.clipboardShortcutHint') }}</span>
        <UiButton
          v-if="historyEnabled"
          variant="default"
          size="small"
          @click="openClipboard"
        >
          {{ t('settings.clipboardOpenWindow') }}
        </UiButton>
      </div>
    </header>

    <UiCard class="settings-card power-card">
      <div class="power-row">
        <div class="power-copy">
          <p class="power-status" :class="{ on: historyEnabled }">
            {{ historyEnabled ? t('settings.clipboardStatusOn') : t('settings.clipboardStatusOff') }}
          </p>
          <p class="row-title">
            {{ t('settings.clipboardEnabled') }}
          </p>
          <p class="row-desc">
            {{ t('settings.clipboardEnabledDesc') }}
          </p>
        </div>
        <UiSwitch
          :model-value="historyEnabled"
          @update:model-value="onClipboardEnabledChange"
        />
      </div>
    </UiCard>

    <div
      class="policy-strip"
      :class="{ dormant: !historyEnabled }"
    >
      <div class="policy-chip">
        <Clock3
          :size="14"
          :stroke-width="1.75"
        />
        <div>
          <span>{{ t('settings.clipboardPolicyRetain') }}</span>
          <strong>{{ expiryLabel }}</strong>
        </div>
      </div>
      <div class="policy-chip">
        <Layers
          :size="14"
          :stroke-width="1.75"
        />
        <div>
          <span>{{ t('settings.clipboardPolicyCap') }}</span>
          <strong>{{ t('settings.clipboardHistoryLimitOption', { n: securitySettings.clipboardHistoryLimit }) }}</strong>
        </div>
      </div>
      <div class="policy-chip">
        <HardDrive
          :size="14"
          :stroke-width="1.75"
        />
        <div>
          <span>{{ t('settings.clipboardPolicyStore') }}</span>
          <strong>{{ securitySettings.clipboardPersistence ? t('settings.clipboardPersistOn') : t('settings.clipboardPersistOff') }}</strong>
        </div>
      </div>
    </div>

    <section :class="{ dormant: !historyEnabled }">
      <h4>{{ t('settings.clipboardRulesTitle') }}</h4>
      <UiCard class="settings-card">
        <div class="row">
          <div>
            <p class="row-title">
              {{ t('settings.clipboardDefaultExpiry') }}
            </p>
            <p class="row-desc">
              {{ t('settings.clipboardDefaultExpiryDesc') }}
            </p>
          </div>
          <UiSelect
            :model-value="String(securitySettings.clipboardDefaultExpiry)"
            class="settings-select"
            :options="clipboardExpirySelectOptions"
            @update:model-value="onClipboardDefaultExpiryChange"
          />
        </div>
        <div class="row last">
          <div>
            <p class="row-title">
              {{ t('settings.clipboardHistoryLimit') }}
            </p>
            <p class="row-desc">
              {{ t('settings.clipboardHistoryLimitDesc') }}
            </p>
          </div>
          <UiSelect
            :model-value="String(securitySettings.clipboardHistoryLimit)"
            class="settings-select"
            :options="clipboardHistoryLimitSelectOptions"
            @update:model-value="onClipboardHistoryLimitChange"
          />
        </div>
      </UiCard>
    </section>

    <section :class="{ dormant: !historyEnabled }">
      <h4>{{ t('settings.clipboardStorageTitle') }}</h4>
      <UiCard class="settings-card">
        <div class="row last">
          <div>
            <p class="row-title">
              {{ t('settings.clipboardPersistence') }}
            </p>
            <p class="row-desc">
              {{ t('settings.clipboardPersistenceDesc') }}
            </p>
          </div>
          <UiSwitch
            :model-value="securitySettings.clipboardPersistence"
            @update:model-value="onClipboardPersistenceChange"
          />
        </div>
      </UiCard>
    </section>
  </div>
</template>

<style scoped>
.clipboard-settings {
  max-width: 680px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.clipboard-hero {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 18px;
  align-items: start;
  padding: 22px 22px 20px;
  overflow: hidden;
  border: 1px solid var(--border-default);
  border-radius: 16px;
  background:
    radial-gradient(ellipse 90% 140% at -8% 0%, rgba(var(--accent-rgb), 0.16), transparent 56%),
    linear-gradient(180deg, color-mix(in srgb, var(--accent-primary) 8%, var(--bg-surface)) 0%, var(--bg-surface) 72%);
  box-shadow: var(--titlebar-shadow, none);
}

.clipboard-hero-mark {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  color: var(--accent-primary);
  background: var(--accent-subtle);
  box-shadow: inset 0 0 0 1px var(--border-accent);
}

.clipboard-kicker {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent-primary);
}

.clipboard-title {
  margin: 0;
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.clipboard-lead {
  max-width: 38em;
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.clipboard-hero-aside {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.clipboard-shortcut {
  display: inline-flex;
  align-items: center;
  padding: 5px 9px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  background: color-mix(in srgb, var(--bg-elevated) 70%, transparent);
  color: var(--text-secondary);
  font: 600 11px/1 var(--font-mono);
  letter-spacing: 0.02em;
}

.power-card {
  overflow: hidden;
  border-color: color-mix(in srgb, var(--accent-primary) 22%, var(--border-default));
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
  color: var(--accent-primary);
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
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.02em;
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

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-default);
}

.row.last {
  border-bottom: none;
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

.dormant {
  opacity: 0.55;
}

@media (max-width: 720px) {
  .clipboard-hero {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .clipboard-hero-aside {
    grid-column: 1 / -1;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .policy-strip {
    grid-template-columns: 1fr;
  }
}
</style>
