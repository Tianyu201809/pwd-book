<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowLeft,
  Sparkles,
  RefreshCw,
  Copy,
} from 'lucide-vue-next'
import { useAppState } from '@/composables/useAppState'
import { showToast } from '@/composables/useToast'
import { evaluatePasswordStrength } from '@/shared/passwordGenerator'
import type { PasswordGenOptions } from '@/types'

const {
  navigateTo,
  passwordGenApplyMode,
  applyGeneratedPassword,
  securitySettings,
  createGeneratedPassword,
} = useAppState()

const { t } = useI18n()

const options = ref<PasswordGenOptions>({
  length: 16,
  upper: true,
  lower: true,
  numbers: true,
  symbols: true,
})

const generated = ref('')

const strengthLabels = computed(() => [
  t('tools.passwordGen.strengthWeak'),
  t('tools.passwordGen.strengthFair'),
  t('tools.passwordGen.strengthStrong'),
  t('tools.passwordGen.strengthVeryStrong'),
])

const strength = computed(() => evaluatePasswordStrength(generated.value))

const strengthLabel = computed(() => strengthLabels.value[strength.value.level])

function regenerate(): void {
  generated.value = createGeneratedPassword(options.value)
}

watch(options, regenerate, { deep: true })

onMounted(() => {
  regenerate()
})

async function copyPassword(): Promise<void> {
  const clearMs = securitySettings.value.clipboardClearEnabled
    ? securitySettings.value.clipboardClearSeconds * 1000
    : 0
  await window.electronAPI?.copySecret(generated.value, clearMs)
  showToast(t('tools.passwordGen.copied'), 'success')
}

function handleApply(): void {
  applyGeneratedPassword(generated.value)
}

function goBack(): void {
  navigateTo('vault')
}
</script>

<template>
  <div class="tool-page-view">
    <div class="tool-page-body">
      <aside class="tool-page-sidebar">
        <button type="button" class="tool-back-btn" @click="goBack">
          <ArrowLeft :size="16" :stroke-width="1.5" />
          {{ t('tools.backToVault') }}
        </button>
        <div class="tool-sidebar-hero">
          <div class="tool-hero-icon tool-hero-icon--gen">
            <Sparkles :size="24" :stroke-width="1.5" />
          </div>
          <h2 class="tool-sidebar-title font-display">{{ t('tools.passwordGen.title') }}</h2>
          <p class="tool-sidebar-desc">{{ t('tools.passwordGen.subtitle') }}</p>
        </div>
      </aside>

      <main class="tool-page-main">
        <div class="tool-page-content">
          <section class="panel-glow surface-card gen-panel">
            <div class="gen-output-wrap">
              <div class="gen-display">{{ generated }}</div>
              <button type="button" class="gen-refresh-btn" :title="t('tools.passwordGen.regenerate')" @click="regenerate">
                <RefreshCw :size="16" :stroke-width="1.5" />
              </button>
            </div>

            <div class="strength-row">
              <div class="strength-bar-track">
                <div
                  v-for="i in 4"
                  :key="i"
                  class="strength-bar-segment"
                  :class="{
                    filled: i <= strength.bars,
                    [`level-${strength.level}`]: i <= strength.bars,
                  }"
                />
              </div>
              <span class="strength-label" :class="`level-${strength.level}`">{{ strengthLabel }}</span>
            </div>

            <div class="length-row">
              <div class="length-header">
                <label>{{ t('tools.passwordGen.length') }}</label>
                <span class="length-value font-mono">{{ options.length }}</span>
              </div>
              <input
                v-model.number="options.length"
                type="range"
                min="8"
                max="32"
                class="length-slider"
              />
            </div>

            <div class="charset-grid">
              <label class="charset-option">
                <input v-model="options.upper" type="checkbox" />
                <span>{{ t('tools.passwordGen.upper') }}</span>
              </label>
              <label class="charset-option">
                <input v-model="options.lower" type="checkbox" />
                <span>{{ t('tools.passwordGen.lower') }}</span>
              </label>
              <label class="charset-option">
                <input v-model="options.numbers" type="checkbox" />
                <span>{{ t('tools.passwordGen.numbers') }}</span>
              </label>
              <label class="charset-option">
                <input v-model="options.symbols" type="checkbox" />
                <span>{{ t('tools.passwordGen.symbols') }}</span>
              </label>
            </div>
          </section>

          <div class="action-row">
            <button type="button" class="btn-primary action-btn" @click="regenerate">
              <Sparkles :size="16" :stroke-width="1.5" />
              {{ t('tools.passwordGen.regenerate') }}
            </button>
            <button type="button" class="btn-ghost action-btn" @click="copyPassword">
              <Copy :size="16" :stroke-width="1.5" />
              {{ t('tools.passwordGen.copy') }}
            </button>
            <button
              v-if="passwordGenApplyMode"
              type="button"
              class="btn-ghost action-btn apply-btn"
              @click="handleApply"
            >
              {{ t('tools.passwordGen.applyToEntry') }}
            </button>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.tool-sidebar-hero {
  padding: 0 8px;
}

.gen-panel {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.gen-output-wrap {
  position: relative;
}

.gen-display {
  padding: 16px 48px 16px 16px;
  text-align: center;
  border-radius: var(--radius-md);
  background: var(--input-bg);
  border: 1px solid var(--border-accent);
  color: var(--accent-primary);
  user-select: all;
}

.gen-refresh-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
}

.gen-refresh-btn:hover {
  color: var(--accent-primary);
}

.strength-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.strength-label {
  font-size: 10px;
  font-weight: 500;
  flex-shrink: 0;
}

.strength-label.level-0 {
  color: var(--status-danger);
}

.strength-label.level-1 {
  color: var(--accent-primary);
}

.strength-label.level-2,
.strength-label.level-3 {
  color: var(--status-success);
}

.length-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.length-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.length-header label {
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.length-value {
  font-size: 12px;
  color: var(--accent-primary);
}

.length-slider {
  width: 100%;
  accent-color: var(--accent-primary);
}

.charset-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.charset-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  cursor: pointer;
  font-size: 12px;
}

.charset-option input {
  accent-color: var(--accent-primary);
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

.apply-btn {
  flex: 1.2;
}
</style>
