<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Clock3, Trash2 } from 'lucide-vue-next'
import { UiButton, UiCard, UiSelect } from '@/components/ui'
import { useAppState } from '@/composables/useAppState'

const { t } = useI18n()
const { securitySettings, updateSecuritySettings, openTrash } = useAppState()

const trashRetentionOptions = [7, 14, 30, 60, 90]

const trashRetentionSelectOptions = computed(() =>
  trashRetentionOptions.map((days) => ({
    value: String(days),
    label: t('common.days', { n: days }),
  })),
)

const retentionLabel = computed(() =>
  t('common.days', { n: securitySettings.value.trashRetentionDays }),
)

async function onTrashRetentionChange(value: string): Promise<void> {
  await updateSecuritySettings({ trashRetentionDays: Number(value) })
}
</script>

<template>
  <div
    class="trash-settings"
    data-tour="settings-trash"
  >
    <header class="module-hero">
      <div class="module-hero-mark">
        <Trash2
          :size="22"
          :stroke-width="1.6"
        />
      </div>
      <div>
        <p class="module-kicker">{{ t('settings.trashTab') }}</p>
        <h3 class="font-display module-title">
          {{ t('settings.trashModuleTitle') }}
        </h3>
        <p class="module-lead">
          {{ t('settings.trashModuleLead') }}
        </p>
      </div>
      <div class="module-hero-aside">
        <UiButton
          variant="default"
          size="small"
          @click="openTrash"
        >
          <Trash2
            :size="14"
            :stroke-width="1.75"
          />
          {{ t('settings.trashOpen') }}
        </UiButton>
      </div>
    </header>

    <div class="policy-strip">
      <div class="policy-chip">
        <Clock3
          :size="14"
          :stroke-width="1.75"
        />
        <div>
          <span>{{ t('settings.trashPolicyKeep') }}</span>
          <strong>{{ retentionLabel }}</strong>
        </div>
      </div>
    </div>

    <section>
      <h4>{{ t('settings.trashRulesTitle') }}</h4>
      <UiCard class="settings-card">
        <div class="row last">
          <div>
            <p class="row-title">{{ t('settings.trashRetention') }}</p>
            <p class="row-desc">{{ t('settings.trashRetentionDesc') }}</p>
          </div>
          <UiSelect
            :model-value="String(securitySettings.trashRetentionDays)"
            class="settings-select"
            :options="trashRetentionSelectOptions"
            @update:model-value="onTrashRetentionChange"
          />
        </div>
      </UiCard>
    </section>
  </div>
</template>

<style scoped>
.trash-settings {
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
    radial-gradient(ellipse 90% 140% at -8% 0%, rgba(220, 38, 38, 0.14), transparent 56%),
    linear-gradient(180deg, color-mix(in srgb, #dc2626 8%, var(--bg-surface)) 0%, var(--bg-surface) 72%);
}

.module-hero-mark {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  color: #ef4444;
  background: rgba(220, 38, 38, 0.14);
  box-shadow: inset 0 0 0 1px rgba(220, 38, 38, 0.28);
}

.module-kicker {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #dc2626;
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
  align-items: center;
}

.policy-strip {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
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
  color: #dc2626;
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
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

@media (max-width: 720px) {
  .module-hero {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .module-hero-aside {
    grid-column: 1 / -1;
  }
}
</style>
