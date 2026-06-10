<script setup lang="ts">
import { ref } from 'vue'
import { Sun, Moon, Monitor, ShieldCheck, Check, TreePalm } from 'lucide-vue-next'
import { Card, Button, Input } from 'animal-island-vue'
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/composables/useTheme'
import { useLocale } from '@/composables/useLocale'
import { UiButton, UiInput, UiCard } from '@/components/ui'
import type { ThemeAccent, ThemeModePref, ThemeSkin } from '@/types'
import type { AppLocale } from '@/i18n'

const { t } = useI18n()
const { locale, localeOptions, setLocale } = useLocale()
const {
  modePref,
  accent,
  skin,
  isClassic,
  isAnimalIsland,
  currentAccent,
  currentSkin,
  currentModeLabel,
  accentOptions,
  modeOptions,
  skinOptions,
  setMode,
  setAccent,
  setSkin,
} = useTheme()

const previewInput = ref('')

const modeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const
</script>

<template>
  <div class="appearance">
    <section>
      <h3>{{ t('appearance.skinTitle') }}</h3>
      <p class="desc">
        {{ t('appearance.skinDesc') }}
      </p>
      <div class="theme-segment skin-segment">
        <button
          v-for="item in skinOptions"
          :key="item.id"
          type="button"
          class="theme-segment-btn skin-btn"
          :class="{ active: skin === item.id }"
          @click="setSkin(item.id as ThemeSkin)"
        >
          <TreePalm
            v-if="item.id === 'animalIsland'"
            :size="16"
            :stroke-width="1.5"
          />
          {{ item.label }}
        </button>
      </div>
    </section>

    <section>
      <h3>{{ t('appearance.languageTitle') }}</h3>
      <p class="desc">
        {{ t('appearance.languageDesc') }}
      </p>
      <div class="theme-segment">
        <button
          v-for="item in localeOptions"
          :key="item.id"
          type="button"
          class="theme-segment-btn"
          :class="{ active: locale === item.id }"
          @click="setLocale(item.id as AppLocale)"
        >
          {{ t(item.labelKey) }}
        </button>
      </div>
    </section>

    <section v-if="isClassic">
      <h3>{{ t('appearance.modeTitle') }}</h3>
      <p class="desc">
        {{ t('appearance.modeDesc') }}
      </p>
      <div class="theme-segment">
        <button
          v-for="mode in modeOptions"
          :key="mode.id"
          type="button"
          class="theme-segment-btn"
          :class="{ active: modePref === mode.id }"
          @click="setMode(mode.id as ThemeModePref)"
        >
          <component
            :is="modeIcons[mode.id]"
            :size="16"
            :stroke-width="1.5"
          />
          {{ mode.label }}
        </button>
      </div>
    </section>

    <section v-if="isClassic">
      <h3>{{ t('appearance.accentTitle') }}</h3>
      <p class="desc">
        {{ t('appearance.accentDesc') }}
      </p>
      <div class="swatch-grid">
        <button
          v-for="item in accentOptions"
          :key="item.id"
          type="button"
          class="swatch-btn"
          :class="{ active: accent === item.id }"
          :title="item.label"
          @click="setAccent(item.id as ThemeAccent)"
        >
          <span
            class="swatch-color"
            :style="{ background: item.color, boxShadow: `0 4px 14px ${item.color}44` }"
          >
            <Check
              class="swatch-check"
              :size="16"
              :stroke-width="2"
            />
          </span>
          <span class="swatch-label">{{ item.label }}</span>
        </button>
      </div>
    </section>

    <section>
      <h3>{{ t('appearance.previewTitle') }}</h3>
      <template v-if="isAnimalIsland">
        <Card
          type="title"
          color="app-teal"
          class="preview-animal-card"
        >
          {{ t('appearance.skinAnimalIslandPreview') }}
        </Card>
        <Card class="preview-animal-body">
          <p class="preview-meta-animal">
            {{ currentSkin?.label }} · {{ currentModeLabel }}
          </p>
          <Input
            v-model="previewInput"
            :placeholder="t('appearance.inputPreview')"
            allow-clear
          />
          <Button
            type="primary"
            block
            style="margin-top: 12px"
          >
            {{ t('appearance.primaryButton') }}
          </Button>
        </Card>
      </template>
      <UiCard
        v-else
        class="preview-card"
      >
        <div class="preview-header">
          <div class="preview-icon">
            <ShieldCheck
              :size="16"
              :stroke-width="1.5"
            />
          </div>
          <div>
            <p class="preview-title">
              {{ t('common.appName') }}
            </p>
            <p class="preview-meta">
              {{ currentModeLabel }} · {{ t('appearance.themeAccent') }}
              <span :style="{ color: currentAccent.color }">{{ currentAccent.label }}</span>
            </p>
          </div>
        </div>
        <div class="preview-body">
          <UiButton
            variant="primary"
            class="preview-primary"
          >
            {{ t('appearance.primaryButton') }}
          </UiButton>
          <div class="preview-tags">
            <span class="preview-tag">{{ t('appearance.tag') }}</span>
            <span class="preview-tag muted">{{ t('appearance.tagMuted') }}</span>
          </div>
          <UiInput
            v-model="previewInput"
            :placeholder="t('appearance.inputPreview')"
          />
        </div>
      </UiCard>
    </section>
  </div>
</template>

<style scoped>
.appearance {
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

h3 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.desc {
  margin: 0 0 16px;
  font-size: 12px;
  color: var(--text-muted);
}

.skin-segment {
  grid-template-columns: 1fr 1fr;
}

.skin-btn {
  justify-content: center;
  gap: 6px;
}

.swatch-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.swatch-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.preview-card {
  overflow: hidden;
  padding: 0 !important;
}

.preview-animal-card {
  margin-bottom: 12px;
}

.preview-animal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-meta-animal {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-elevated);
}

.preview-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-subtle);
  border: 1px solid var(--border-accent);
  color: var(--accent-primary);
}

.preview-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
}

.preview-meta {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.preview-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-primary {
  width: 100%;
  padding: 10px;
  font-size: 14px;
}

.preview-tags {
  display: flex;
  gap: 8px;
}

.preview-tag {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 8px;
  background: var(--accent-subtle);
  color: var(--accent-primary);
  font-weight: 500;
}

.preview-tag.muted {
  background: var(--bg-hover);
  color: var(--text-secondary);
  font-weight: 400;
}
</style>
