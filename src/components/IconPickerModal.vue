<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, X } from 'lucide-vue-next'
import CategoryIconView from '@/components/CategoryIconView.vue'
import { translateIconLabel } from '@/i18n'
import { CATEGORY_ICON_OPTIONS } from '@/shared/categoryIcons'

const props = withDefaults(
  defineProps<{
    open: boolean
    selected?: string
    title?: string
    allowClear?: boolean
  }>(),
  {
    allowClear: true,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [icon: string]
  clear: []
}>()

const { t } = useI18n()

const query = ref('')

watch(
  () => props.open,
  (open) => {
    if (open) query.value = ''
  },
)

const filteredIcons = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return CATEGORY_ICON_OPTIONS
  return CATEGORY_ICON_OPTIONS.filter(
    (icon) =>
      translateIconLabel(icon.value).toLowerCase().includes(keyword) ||
      icon.value.toLowerCase().includes(keyword),
  )
})

function close(): void {
  emit('update:open', false)
}

function choose(icon: string): void {
  emit('select', icon)
  close()
}

function useLetterAvatar(): void {
  emit('clear')
  close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="picker-fade">
      <div v-if="open" class="picker-overlay" @click.self="close">
        <div class="picker-panel surface-card">
          <header class="picker-header">
            <button type="button" class="header-btn" :aria-label="t('common.close')" @click="close">
              <X :size="18" :stroke-width="1.5" />
            </button>
            <h3 class="picker-title">{{ title ?? t('icons.pickIcon') }}</h3>
            <span class="header-spacer" />
          </header>

          <div class="search-wrap">
            <Search :size="16" :stroke-width="1.5" class="search-icon" />
            <input
              v-model="query"
              class="search-input"
              :placeholder="t('common.search')"
              autofocus
            />
          </div>

          <div class="picker-body">
            <p v-if="filteredIcons.length === 0" class="empty-text">{{ t('icons.noMatch') }}</p>
            <div v-else class="icon-grid">
              <button
                v-for="icon in filteredIcons"
                :key="icon.value"
                type="button"
                class="icon-cell"
                :class="{ selected: selected === icon.value }"
                :title="translateIconLabel(icon.value)"
                :style="
                  selected === icon.value
                    ? { borderColor: icon.color, background: icon.bg }
                    : undefined
                "
                @click="choose(icon.value)"
              >
                <CategoryIconView :name="icon.value" :badge-size="40" :size="20" />
              </button>
            </div>
          </div>

          <footer v-if="allowClear" class="picker-footer">
            <button type="button" class="reset-btn" @click="useLetterAvatar">
              {{ t('icons.useInitial') }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
}

.picker-panel {
  width: min(420px, calc(100vw - 32px));
  max-height: min(640px, calc(100vh - 32px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.picker-header {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  padding: 12px 12px 8px;
  border-bottom: 1px solid var(--border-default);
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}

.header-btn:hover {
  background: var(--bg-hover);
}

.picker-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  letter-spacing: -0.02em;
}

.header-spacer {
  width: 36px;
}

.search-wrap {
  position: relative;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-default);
}

.search-icon {
  position: absolute;
  left: 28px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 10px 12px 10px 36px;
  border: 1px solid var(--border-default);
  border-radius: 10px;
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

.picker-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 16px 8px;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}

.icon-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  transition: transform 0.12s ease, border-color 0.12s ease, background-color 0.12s ease;
}

.icon-cell:hover {
  transform: scale(1.04);
  background: var(--bg-hover);
}

.icon-cell.selected {
  box-shadow: 0 0 0 1px currentColor;
}

.empty-text {
  margin: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

.picker-footer {
  padding: 10px 16px 14px;
  border-top: 1px solid var(--border-default);
}

.reset-btn {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.reset-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.picker-fade-enter-active,
.picker-fade-leave-active {
  transition: opacity 0.18s ease;
}

.picker-fade-enter-active .picker-panel,
.picker-fade-leave-active .picker-panel {
  transition: transform 0.18s ease;
}

.picker-fade-enter-from,
.picker-fade-leave-to {
  opacity: 0;
}

.picker-fade-enter-from .picker-panel,
.picker-fade-leave-to .picker-panel {
  transform: scale(0.98) translateY(6px);
}
</style>
