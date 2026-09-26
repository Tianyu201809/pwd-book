<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Keyboard, Lock, StickyNote } from 'lucide-vue-next'
import { UiButton, UiCard, UiSwitch } from '@/components/ui'
import ShortcutRecorder from '@/components/ShortcutRecorder.vue'
import { useAppState } from '@/composables/useAppState'
import { showToast } from '@/composables/useToast'
import { DEFAULT_ACCELERATORS, otherAccelerators } from '@/shared/globalAccelerator'

const { t } = useI18n()
const { securitySettings, updateSecuritySettings } = useAppState()

const enabled = computed(() => securitySettings.value.notesManagerShortcutEnabled)
const accelerator = computed(() => securitySettings.value.notesManagerAccelerator)
const reserved = computed(() =>
  otherAccelerators(securitySettings.value, 'notes', {
    notes: t('settings.shortcutSlotNotes'),
    clipboard: t('settings.shortcutSlotClipboard'),
    quickBar: t('settings.shortcutSlotQuickBar'),
    main: t('settings.shortcutSlotMain'),
  }),
)

async function onShortcutEnabledChange(next: boolean): Promise<void> {
  await updateSecuritySettings({ notesManagerShortcutEnabled: next })
}

async function saveAccelerator(next: string): Promise<void> {
  await updateSecuritySettings({ notesManagerAccelerator: next })
}

async function openNotesManager(): Promise<void> {
  try {
    const opened = await window.electronAPI?.openNotesManager?.()
    if (!opened) showToast(t('notes.openFailed'), 'error')
  } catch {
    showToast(t('notes.openFailed'), 'error')
  }
}
</script>

<template>
  <div
    class="notes-settings"
    data-tour="settings-notes"
  >
    <header class="module-hero">
      <div class="module-hero-mark">
        <StickyNote
          :size="22"
          :stroke-width="1.6"
        />
      </div>
      <div>
        <p class="module-kicker">{{ t('settings.notesTab') }}</p>
        <h3 class="font-display module-title">
          {{ t('settings.notesModuleTitle') }}
        </h3>
        <p class="module-lead">
          {{ t('settings.notesModuleLead') }}
        </p>
      </div>
      <div class="module-hero-aside">
        <span class="module-shortcut">{{ accelerator }}</span>
        <UiButton
          variant="default"
          size="small"
          @click="openNotesManager"
        >
          <StickyNote
            :size="14"
            :stroke-width="1.75"
          />
          {{ t('settings.notesOpenManager') }}
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
            {{ enabled ? t('settings.notesStatusOn') : t('settings.notesStatusOff') }}
          </p>
          <p class="row-title">{{ t('settings.notesManagerShortcut') }}</p>
          <p class="row-desc">
            {{ t('settings.notesManagerShortcutDesc') }}
          </p>
        </div>
        <UiSwitch
          :model-value="enabled"
          @update:model-value="onShortcutEnabledChange"
        />
      </div>
    </UiCard>

    <UiCard class="settings-card shortcut-card">
      <div class="shortcut-row">
        <div>
          <p class="row-title">
            {{ t('settings.shortcutSection') }}
          </p>
          <p class="row-desc">
            {{ t('settings.shortcutSectionDesc') }}
          </p>
        </div>
        <ShortcutRecorder
          :accelerator="accelerator"
          :fallback="DEFAULT_ACCELERATORS.notes"
          :reserved="reserved"
          :save="saveAccelerator"
        />
      </div>
    </UiCard>

    <div
      class="policy-strip"
      :class="{ dormant: !enabled }"
    >
      <div class="policy-chip">
        <Keyboard
          :size="14"
          :stroke-width="1.75"
        />
        <div>
          <span>{{ t('settings.notesPolicyShortcut') }}</span>
          <strong>{{ accelerator }}</strong>
        </div>
      </div>
      <div class="policy-chip">
        <Lock
          :size="14"
          :stroke-width="1.75"
        />
        <div>
          <span>{{ t('settings.notesPolicyLocked') }}</span>
          <strong>{{ t('settings.notesPolicyLockedValue') }}</strong>
        </div>
      </div>
      <div class="policy-chip">
        <StickyNote
          :size="14"
          :stroke-width="1.75"
        />
        <div>
          <span>{{ t('settings.notesPolicyToggle') }}</span>
          <strong>{{ t('settings.notesPolicyToggleValue') }}</strong>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notes-settings {
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
    radial-gradient(ellipse 90% 140% at -8% 0%, rgba(216, 137, 36, 0.18), transparent 56%),
    linear-gradient(180deg, color-mix(in srgb, #d88924 10%, var(--bg-surface)) 0%, var(--bg-surface) 72%);
}

.module-hero-mark {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  color: #d88924;
  background: rgba(216, 137, 36, 0.14);
  box-shadow: inset 0 0 0 1px rgba(216, 137, 36, 0.28);
}

.module-kicker {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #d88924;
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
  border-color: color-mix(in srgb, #d88924 22%, var(--border-default));
}

.power-row,
.shortcut-row {
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
  color: #d88924;
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

  .shortcut-row {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
