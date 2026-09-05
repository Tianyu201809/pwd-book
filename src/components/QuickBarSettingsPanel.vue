<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Keyboard, Layers, PanelTop } from 'lucide-vue-next'
import { UiButton, UiCard, UiSelect, UiSwitch } from '@/components/ui'
import { useAppState } from '@/composables/useAppState'

const { t } = useI18n()
const { securitySettings, updateSecuritySettings } = useAppState()

const enabled = computed(() => securitySettings.value.quickBarEnabled)
const quickBarRecentLimitOptions = Array.from({ length: 16 }, (_, index) => index + 5)

const quickBarRecentLimitSelectOptions = computed(() =>
  quickBarRecentLimitOptions.map((n) => ({
    value: String(n),
    label: t('settings.quickBarRecentLimitOption', { n }),
  })),
)

async function onQuickBarEnabledChange(next: boolean): Promise<void> {
  await updateSecuritySettings({ quickBarEnabled: next })
}

async function onQuickBarRecentLimitChange(value: string): Promise<void> {
  await updateSecuritySettings({ quickBarRecentLimit: Number(value) })
}

async function onMainWindowShortcutEnabledChange(next: boolean): Promise<void> {
  await updateSecuritySettings({ mainWindowShortcutEnabled: next })
}

function openQuickBar(): void {
  window.electronAPI?.showQuickBar?.()
}
</script>

<template>
  <div
    class="quickbar-settings"
    data-tour="settings-quickbar"
  >
    <header class="module-hero">
      <div class="module-hero-mark">
        <PanelTop
          :size="22"
          :stroke-width="1.6"
        />
      </div>
      <div>
        <p class="module-kicker">{{ t('settings.quickBarTab') }}</p>
        <h3 class="font-display module-title">
          {{ t('settings.quickBarModuleTitle') }}
        </h3>
        <p class="module-lead">
          {{ t('settings.quickBarModuleLead') }}
        </p>
      </div>
      <div class="module-hero-aside">
        <span class="module-shortcut">{{ securitySettings.quickBarAccelerator }}</span>
        <UiButton
          v-if="enabled"
          variant="default"
          size="small"
          @click="openQuickBar"
        >
          <PanelTop
            :size="14"
            :stroke-width="1.75"
          />
          {{ t('settings.quickBarOpen') }}
        </UiButton>
      </div>
    </header>

    <UiCard class="settings-card power-card">
      <div class="power-row">
        <div>
          <p
            class="power-status"
            :class="{ on: enabled }"
          >
            {{ enabled ? t('settings.quickBarStatusOn') : t('settings.quickBarStatusOff') }}
          </p>
          <p class="row-title">{{ t('settings.quickBar') }}</p>
          <p class="row-desc">
            {{ t('settings.quickBarDesc', { accelerator: securitySettings.quickBarAccelerator }) }}
          </p>
        </div>
        <UiSwitch
          :model-value="enabled"
          @update:model-value="onQuickBarEnabledChange"
        />
      </div>
    </UiCard>

    <div
      class="policy-strip"
      :class="{ dormant: !enabled }"
    >
      <div class="policy-chip">
        <PanelTop
          :size="14"
          :stroke-width="1.75"
        />
        <div>
          <span>{{ t('settings.quickBarPolicyShortcut') }}</span>
          <strong>{{ securitySettings.quickBarAccelerator }}</strong>
        </div>
      </div>
      <div class="policy-chip">
        <Layers
          :size="14"
          :stroke-width="1.75"
        />
        <div>
          <span>{{ t('settings.quickBarPolicyLimit') }}</span>
          <strong>{{ t('settings.quickBarRecentLimitOption', { n: securitySettings.quickBarRecentLimit }) }}</strong>
        </div>
      </div>
      <div class="policy-chip">
        <Keyboard
          :size="14"
          :stroke-width="1.75"
        />
        <div>
          <span>{{ t('settings.quickBarPolicyMain') }}</span>
          <strong>{{ securitySettings.mainWindowShortcutEnabled ? t('settings.quickBarStatusOn') : t('settings.quickBarStatusOff') }}</strong>
        </div>
      </div>
    </div>

    <section :class="{ dormant: !enabled }">
      <h4>{{ t('settings.quickBarRulesTitle') }}</h4>
      <UiCard class="settings-card">
        <div class="row">
          <div>
            <p class="row-title">{{ t('settings.quickBarRecentLimit') }}</p>
            <p class="row-desc">{{ t('settings.quickBarRecentLimitDesc') }}</p>
          </div>
          <UiSelect
            :model-value="String(securitySettings.quickBarRecentLimit)"
            class="settings-select"
            :options="quickBarRecentLimitSelectOptions"
            @update:model-value="onQuickBarRecentLimitChange"
          />
        </div>
        <div class="row last">
          <div>
            <p class="row-title">{{ t('settings.mainWindowShortcut') }}</p>
            <p class="row-desc">
              {{
                t('settings.mainWindowShortcutDesc', {
                  accelerator: securitySettings.mainWindowShortcutAccelerator,
                })
              }}
            </p>
          </div>
          <UiSwitch
            :model-value="securitySettings.mainWindowShortcutEnabled"
            @update:model-value="onMainWindowShortcutEnabledChange"
          />
        </div>
      </UiCard>
    </section>
  </div>
</template>

<style scoped>
.quickbar-settings {
  max-width: 680px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.module-hero {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 18px;
  align-items: start;
  padding: 22px 22px 20px;
  overflow: hidden;
  border: 1px solid var(--border-default);
  border-radius: 16px;
  background:
    radial-gradient(ellipse 90% 140% at -8% 0%, rgba(217, 119, 6, 0.16), transparent 56%),
    linear-gradient(180deg, color-mix(in srgb, #d97706 8%, var(--bg-surface)) 0%, var(--bg-surface) 72%);
}

.module-hero-mark {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  color: #f59e0b;
  background: rgba(217, 119, 6, 0.14);
  box-shadow: inset 0 0 0 1px rgba(217, 119, 6, 0.28);
}

.module-kicker {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #d97706;
}

.module-title {
  margin: 0;
  font-size: 26px;
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.module-lead {
  max-width: 40em;
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary);
}

.module-hero-aside {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.module-shortcut {
  display: inline-flex;
  padding: 5px 9px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  background: color-mix(in srgb, var(--bg-elevated) 70%, transparent);
  color: var(--text-secondary);
  font: 600 11px/1 var(--font-mono);
}

.power-card {
  overflow: hidden;
  border-color: color-mix(in srgb, #d97706 22%, var(--border-default));
}

.power-row,
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.power-row {
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
  color: #d97706;
}

.policy-chip div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.policy-chip span {
  font-size: 11px;
  color: var(--text-muted);
}

.policy-chip strong {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
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
  .module-hero {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .module-hero-aside {
    grid-column: 1 / -1;
    flex-direction: row;
    justify-content: space-between;
  }

  .policy-strip {
    grid-template-columns: 1fr;
  }
}
</style>
