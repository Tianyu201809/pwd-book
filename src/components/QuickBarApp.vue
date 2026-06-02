<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, Lock, X } from 'lucide-vue-next'
import CategoryIconView from '@/components/CategoryIconView.vue'
import ToastHost from '@/components/ToastHost.vue'
import { syncLocaleFromStorage } from '@/composables/useLocale'
import { showToast } from '@/composables/useToast'
import { syncThemeFromStorage, useTheme } from '@/composables/useTheme'
import { filterEntriesBySearch } from '@/shared/entrySearch'
import { launchEntry } from '@/shared/launchEntry'
import { getAvatarMeta, parseErrorMessage } from '@/shared/utils'
import type { PasswordEntry } from '@/types'

const { t } = useI18n()
const { isAnimalIsland } = useTheme()

function refreshChrome(): void {
  syncThemeFromStorage()
  syncLocaleFromStorage()
}

const query = ref('')
const entries = ref<PasswordEntry[]>([])
const recentEntries = ref<PasswordEntry[]>([])
const unlocked = ref(false)
const loading = ref(true)
const activeIndex = ref(0)
const rootRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

const results = computed(() => filterEntriesBySearch(entries.value, query.value, 12))

const listItems = computed(() =>
  query.value.trim() ? results.value : recentEntries.value,
)

const showRecent = computed(
  () =>
    unlocked.value &&
    !query.value.trim() &&
    recentEntries.value.length > 0 &&
    !loading.value,
)

const isRecentList = computed(() => showRecent.value && !query.value.trim())

const showList = computed(() => {
  if (!unlocked.value || loading.value) return false
  if (query.value.trim()) return results.value.length > 0
  return recentEntries.value.length > 0
})

const showEmpty = computed(
  () => unlocked.value && query.value.trim().length > 0 && results.value.length === 0 && !loading.value,
)

async function refreshEntries(): Promise<void> {
  loading.value = true
  try {
    const status = await window.electronAPI?.getVaultStatus()
    unlocked.value = Boolean(status?.unlocked)
    if (unlocked.value) {
      const api = window.electronAPI
      entries.value = (await api?.listEntries()) ?? []
      recentEntries.value = (await api?.listQuickBarRecent()) ?? []
    } else {
      entries.value = []
      recentEntries.value = []
    }
  } finally {
    loading.value = false
  }
}

function reportHeight(): void {
  nextTick(() => {
    const height = rootRef.value?.offsetHeight ?? 52
    window.electronAPI?.resizeQuickBar?.(height)
  })
}

function focusMain(): void {
  window.electronAPI?.quickBarShowMain?.()
  window.electronAPI?.hideQuickBar?.()
}

async function activateEntry(entry: PasswordEntry): Promise<void> {
  const api = window.electronAPI
  if (!api) return
  try {
    const settings = await api.getSettings()
    const kind = await launchEntry(
      entry,
      { openUrlWithCredentials: settings.openUrlWithCredentials },
      api,
    )
    if (kind === 'none') {
      showToast(t('quickBar.noLaunchTarget'), 'error')
      return
    }
    api.hideQuickBar?.()
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  }
}

async function removeFromRecent(entry: PasswordEntry, event: MouseEvent): Promise<void> {
  event.preventDefault()
  event.stopPropagation()
  const api = window.electronAPI
  if (!api?.removeQuickBarRecent) return
  try {
    recentEntries.value = await api.removeQuickBarRecent(entry.id)
    if (activeIndex.value >= listItems.value.length) {
      activeIndex.value = Math.max(0, listItems.value.length - 1)
    }
    reportHeight()
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  }
}

function onSelectActive(): void {
  const entry = listItems.value[activeIndex.value]
  if (entry) void activateEntry(entry)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    window.electronAPI?.hideQuickBar?.()
    return
  }
  if (!listItems.value.length) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, listItems.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    onSelectActive()
  }
}

let removeShownListener: (() => void) | undefined

watch([query, listItems, showList, showEmpty, unlocked], () => {
  activeIndex.value = 0
  reportHeight()
})

onMounted(async () => {
  await refreshEntries()
  reportHeight()
  inputRef.value?.focus()
  removeShownListener = window.electronAPI?.onQuickBarShown?.(() => {
    refreshChrome()
    void refreshEntries().then(() => {
      query.value = ''
      activeIndex.value = 0
      reportHeight()
      inputRef.value?.focus()
    })
  })
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  removeShownListener?.()
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    ref="rootRef"
    class="quickbar-root"
    :class="{ 'quickbar-root--animal': isAnimalIsland }"
  >
    <div class="quickbar-strip">
      <Search class="quickbar-search-icon" :size="16" :stroke-width="1.75" />
      <template v-if="unlocked">
        <input
          ref="inputRef"
          v-model="query"
          type="text"
          class="quickbar-input"
          :class="{ 'quickbar-input--animal': isAnimalIsland }"
          :placeholder="t('quickBar.placeholder')"
          spellcheck="false"
          autocomplete="off"
        />
        <span v-if="query || showRecent" class="quickbar-hint">{{ t('quickBar.hintNavigate') }}</span>
      </template>
      <button v-else type="button" class="quickbar-locked" @click="focusMain">
        <Lock :size="14" :stroke-width="1.75" />
        {{ t('quickBar.locked') }}
      </button>
    </div>

    <p v-if="showRecent" class="quickbar-section-label">{{ t('quickBar.recentOpened') }}</p>

    <ul
      v-if="showList && listItems.length"
      class="quickbar-results"
      :class="{ 'quickbar-results--top-border': !showRecent }"
      role="listbox"
    >
      <li
        v-for="(entry, index) in listItems"
        :key="entry.id"
        role="option"
        :aria-selected="index === activeIndex"
        class="quickbar-result"
        :class="{ 'quickbar-result--active': index === activeIndex, 'quickbar-result--recent': isRecentList }"
        @mousedown.prevent="activateEntry(entry)"
        @mouseenter="activeIndex = index"
      >
        <span class="quickbar-avatar">
          <CategoryIconView
            v-if="entry.displayIcon"
            :name="entry.displayIcon"
            :size="14"
          />
          <span
            v-else
            class="quickbar-avatar-letter"
            :style="{ background: getAvatarMeta(entry.title).color }"
          >
            {{ getAvatarMeta(entry.title).text }}
          </span>
        </span>
        <span class="quickbar-result-main">
          <span class="quickbar-result-title">{{ entry.title }}</span>
          <span class="quickbar-result-meta">
            {{ entry.username || t('vault.noAccount') }}
            <template v-if="entry.categoryName"> · {{ entry.categoryName }}</template>
          </span>
        </span>
        <button
          v-if="isRecentList"
          type="button"
          class="quickbar-result-remove"
          :title="t('quickBar.removeFromRecent')"
          :aria-label="t('quickBar.removeFromRecent')"
          @mousedown.prevent.stop="removeFromRecent(entry, $event)"
        >
          <X :size="14" :stroke-width="2" />
        </button>
      </li>
    </ul>

    <p v-else-if="showEmpty" class="quickbar-empty">{{ t('quickBar.noMatch') }}</p>
    <ToastHost />
  </div>
</template>
