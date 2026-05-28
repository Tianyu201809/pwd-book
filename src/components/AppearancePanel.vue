<script setup lang="ts">
import { Sun, Moon, Monitor, ShieldCheck, Check } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'
import type { ThemeAccent, ThemeModePref } from '@/types'

const {
  modePref,
  accent,
  currentAccent,
  currentModeLabel,
  accentOptions,
  modeOptions,
  setMode,
  setAccent,
} = useTheme()

const modeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const
</script>

<template>
  <div class="appearance">
    <section>
      <h3>外观模式</h3>
      <p class="desc">切换浅色、深色，或跟随系统设置自动切换</p>
      <div class="theme-segment">
        <button
          v-for="mode in modeOptions"
          :key="mode.id"
          type="button"
          class="theme-segment-btn"
          :class="{ active: modePref === mode.id }"
          @click="setMode(mode.id as ThemeModePref)"
        >
          <component :is="modeIcons[mode.id]" :size="16" :stroke-width="1.5" />
          {{ mode.label }}
        </button>
      </div>
    </section>

    <section>
      <h3>主题色</h3>
      <p class="desc">选择强调色，按钮、选中态、标签等将同步更新</p>
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
          <span class="swatch-color" :style="{ background: item.color, boxShadow: `0 4px 14px ${item.color}44` }">
            <Check class="swatch-check" :size="16" :stroke-width="2" />
          </span>
          <span class="swatch-label">{{ item.label }}</span>
        </button>
      </div>
    </section>

    <section>
      <h3>预览</h3>
      <div class="surface-card preview-card">
        <div class="preview-header">
          <div class="preview-icon">
            <ShieldCheck :size="16" :stroke-width="1.5" />
          </div>
          <div>
            <p class="preview-title">PwdBook</p>
            <p class="preview-meta">
              {{ currentModeLabel }} · 主题色
              <span :style="{ color: currentAccent.color }">{{ currentAccent.label }}</span>
            </p>
          </div>
        </div>
        <div class="preview-body">
          <button type="button" class="btn-primary preview-primary">主要按钮</button>
          <div class="preview-tags">
            <span class="preview-tag">标签</span>
            <span class="preview-tag muted">次要</span>
          </div>
          <div class="preview-input">输入框预览</div>
        </div>
      </div>
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

.preview-input {
  padding: 10px 12px;
  border-radius: 12px;
  font-size: 14px;
  background: var(--input-bg);
  border: 1px solid var(--input-border);
  color: var(--text-muted);
}
</style>
