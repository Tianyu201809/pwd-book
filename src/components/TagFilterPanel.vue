<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from 'lucide-vue-next'
import { UiInput, UiCheckbox } from '@/components/ui'
import { useTheme } from '@/composables/useTheme'
import { useAppState } from '@/composables/useAppState'
import { textMatchesQuery } from '@/shared/searchMatch'

const { vaultTags, selectedTagFilters, toggleTagFilter, clearTagFilters } = useAppState()

const { t } = useI18n()
const { isAnimalIsland } = useTheme()

const searchQuery = ref('')

const filteredTags = computed(() => {
  const q = searchQuery.value.trim()
  if (!q) return vaultTags.value
  return vaultTags.value.filter((tag) => textMatchesQuery(tag.name, q))
})

function isTagSelected(name: string): boolean {
  const lower = name.trim().toLowerCase()
  return selectedTagFilters.value.some((tag) => tag.trim().toLowerCase() === lower)
}

function onTagRowClick(name: string): void {
  toggleTagFilter(name)
}
</script>

<template>
  <div class="tag-filter-panel">
    <div class="tag-filter-search">
      <UiInput
        v-model="searchQuery"
        class="tag-filter-search-input"
        :class="{ 'tag-filter-search-input--animal': isAnimalIsland }"
        :placeholder="t('vault.tagFilterSearchPlaceholder')"
        allow-clear
      >
        <template v-if="isAnimalIsland" #prefix>
          <Search :size="14" :stroke-width="1.5" />
        </template>
      </UiInput>
    </div>

    <p class="tag-filter-hint">{{ t('vault.tagFilterAndHint') }}</p>

    <div v-if="selectedTagFilters.length" class="tag-filter-toolbar">
      <span class="tag-filter-selected-hint">
        {{ t('vault.tagFilterSelectedCount', { count: selectedTagFilters.length }) }}
      </span>
      <button type="button" class="tag-filter-clear-btn" @click="clearTagFilters">
        {{ t('vault.tagFilterClear') }}
      </button>
    </div>

    <div class="tag-filter-list" role="listbox" :aria-label="t('vault.tagFilterTitle')" aria-multiselectable="true">
      <p v-if="filteredTags.length === 0" class="tag-filter-empty">
        {{ t('vault.tagFilterNoMatch') }}
      </p>
      <div
        v-for="tag in filteredTags"
        :key="tag.name"
        class="tag-filter-option"
        :class="{ 'tag-filter-option--selected': isTagSelected(tag.name) }"
        role="option"
        :aria-selected="isTagSelected(tag.name)"
        tabindex="0"
        @click="onTagRowClick(tag.name)"
        @keydown.enter.prevent="onTagRowClick(tag.name)"
        @keydown.space.prevent="onTagRowClick(tag.name)"
      >
        <UiCheckbox
          :model-value="isTagSelected(tag.name)"
          class="tag-filter-option-checkbox"
          aria-hidden="true"
          tabindex="-1"
        />
        <span class="tag-filter-option-label">{{ tag.name }}</span>
        <span class="tag-filter-option-count">{{ tag.entryCount }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tag-filter-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.tag-filter-search {
  min-width: 0;
}

.tag-filter-search-input {
  width: 100%;
}

.tag-filter-search-input :deep(.input-field) {
  padding: 8px 12px;
  font-size: 13px;
  min-height: 36px;
}

.tag-filter-search-input--animal {
  font-size: 13px;
  min-height: 36px;
}

.tag-filter-search-input--animal :deep(.animal-input__inner) {
  min-height: 36px;
}

.tag-filter-hint {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.35;
}

.tag-filter-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.tag-filter-selected-hint {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

.tag-filter-clear-btn {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-primary);
  cursor: pointer;
}

.tag-filter-clear-btn:hover {
  text-decoration: underline;
}

.tag-filter-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: min(200px, 32vh);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  margin: 0 -4px;
  padding: 0 4px;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--scrollbar-thumb) 42%, transparent) transparent;
}

.tag-filter-list::-webkit-scrollbar {
  width: 6px;
}

.tag-filter-list::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--scrollbar-thumb) 50%, transparent);
  border-radius: 99px;
}

.tag-filter-option {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 6px 8px;
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: background-color 0.15s;
}

.tag-filter-option:hover {
  background: var(--bg-hover);
}

.tag-filter-option--selected {
  background: color-mix(in srgb, var(--accent-subtle) 70%, transparent);
}

.tag-filter-option-checkbox {
  flex-shrink: 0;
  pointer-events: none;
}

.tag-filter-option:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 1px;
}

.tag-filter-option-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--text-secondary);
}

.tag-filter-option-count {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  min-width: 1.5em;
  text-align: right;
}

.tag-filter-empty {
  margin: 0;
  padding: 8px 4px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}
</style>
