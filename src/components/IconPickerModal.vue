<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from 'lucide-vue-next'
import CategoryIconView from '@/components/CategoryIconView.vue'
import { translateIconLabel } from '@/i18n'
import {
  BASE_CATEGORY_ICON_OPTIONS,
  LETTER_ICON_OPTIONS,
  isLetterIcon,
} from '@/shared/categoryIcons'
import { formatPresetIconId, isPresetIcon, searchPresetIcons } from '@/shared/presetIcons'
import { hasPresetIconAsset } from '@/shared/presetIconAssets'
import { UiModal, UiInput, UiButton } from '@/components/ui'
import { useTheme } from '@/composables/useTheme'

type PickerTab = 'icons' | 'letters' | 'brands'

const open = defineModel<boolean>('open', { default: false })

const props = withDefaults(
  defineProps<{
    selected?: string
    title?: string
    allowClear?: boolean
    allowPresets?: boolean
  }>(),
  {
    allowClear: true,
    allowPresets: false,
    selected: undefined,
    title: undefined,
  },
)

const emit = defineEmits<{
  select: [icon: string]
  clear: []
}>()

const { t, locale } = useI18n()
const { isAnimalIsland } = useTheme()

const query = ref('')
const activeTab = ref<PickerTab>('icons')

const tabItems = computed(() => {
  const items: { key: PickerTab; label: string }[] = [
    { key: 'icons', label: t('icons.tabIcons') },
    { key: 'letters', label: t('icons.tabLetters') },
  ]
  if (props.allowPresets) {
    items.push({ key: 'brands', label: t('icons.tabBrands') })
  }
  return items
})

watch(open, (isOpen) => {
  if (!isOpen) return
  query.value = ''
  if (props.allowPresets && props.selected && isPresetIcon(props.selected)) {
    activeTab.value = 'brands'
    return
  }
  activeTab.value = props.selected && isLetterIcon(props.selected) ? 'letters' : 'icons'
})

const brandCells = computed(() =>
  searchPresetIcons(query.value)
    .filter((icon) => hasPresetIconAsset(icon.id))
    .map((icon) => ({
      value: formatPresetIconId(icon.id),
      label: String(locale.value).startsWith('zh') ? icon.labelZh : icon.labelEn,
      color: '#64748b',
      bg: 'transparent',
    })),
)

const filteredIcons = computed(() => {
  if (activeTab.value === 'brands') return brandCells.value
  const source = activeTab.value === 'letters' ? LETTER_ICON_OPTIONS : BASE_CATEGORY_ICON_OPTIONS
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return source
  return source.filter(
    (icon) =>
      translateIconLabel(icon.value).toLowerCase().includes(keyword) ||
      icon.value.toLowerCase().includes(keyword),
  )
})

function cellTitle(icon: { value: string; label?: string }): string {
  if (activeTab.value === 'brands' && icon.label) return icon.label
  return translateIconLabel(icon.value)
}

function close(): void {
  open.value = false
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
  <UiModal
    v-model:open="open"
    :title="title ?? t('icons.pickIcon')"
    :width="480"
    :show-footer="false"
    @close="close"
  >
    <div class="picker-inner">
      <div class="search-wrap">
        <Search
          v-if="!isAnimalIsland"
          :size="16"
          :stroke-width="1.5"
          class="search-icon"
        />
        <UiInput
          v-model="query"
          class="search-input"
          :class="{ 'search-input--animal': isAnimalIsland }"
          :placeholder="t('common.search')"
          allow-clear
        >
          <template
            v-if="isAnimalIsland"
            #prefix
          >
            <Search
              :size="16"
              :stroke-width="1.5"
            />
          </template>
        </UiInput>
      </div>

      <div
        class="picker-tabs"
        role="tablist"
        :aria-label="t('icons.pickIcon')"
      >
        <button
          v-for="tab in tabItems"
          :key="tab.key"
          type="button"
          role="tab"
          class="picker-tab"
          :class="{ active: activeTab === tab.key }"
          :aria-selected="activeTab === tab.key"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <div class="picker-body">
        <p
          v-if="filteredIcons.length === 0"
          class="empty-text"
        >
          {{ t('icons.noMatch') }}
        </p>
        <div
          v-else
          class="icon-grid"
          :class="{ 'icon-grid--letters': activeTab === 'letters' }"
        >
          <button
            v-for="icon in filteredIcons"
            :key="icon.value"
            type="button"
            class="icon-cell"
            :class="{ selected: selected === icon.value }"
            :title="cellTitle(icon)"
            :style="
              selected === icon.value
                ? { borderColor: icon.color, background: icon.bg }
                : undefined
            "
            @click="choose(icon.value)"
          >
            <CategoryIconView
              :name="icon.value"
              :badge-size="40"
              :size="20"
            />
          </button>
        </div>
      </div>

      <footer
        v-if="allowClear"
        class="picker-footer"
      >
        <UiButton
          variant="text"
          @click="useLetterAvatar"
        >
          {{ t('icons.useInitial') }}
        </UiButton>
      </footer>
    </div>
  </UiModal>
</template>

<style scoped>
.picker-inner {
  display: flex;
  flex-direction: column;
  min-height: 0;
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

.search-wrap :deep(.input-field) {
  width: 100%;
  padding: 10px 12px 10px 36px;
  border: 1px solid var(--border-default);
  border-radius: 10px;
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 14px;
}

.search-wrap :deep(.input-field:focus) {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

.picker-tabs {
  display: flex;
  gap: 4px;
  padding: 10px 16px 0;
  border-bottom: 1px solid var(--border-default);
}

.picker-tab {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.picker-tab:hover {
  color: var(--text-primary);
}

.picker-tab.active {
  color: var(--accent-primary);
  border-bottom-color: var(--accent-primary);
  font-weight: 600;
}

.picker-body {
  flex: 1;
  min-height: 240px;
  max-height: min(360px, calc(100vh - 280px));
  overflow-y: auto;
  padding: 12px 16px 8px;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}

.icon-grid--letters {
  grid-template-columns: repeat(6, 1fr);
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
</style>
