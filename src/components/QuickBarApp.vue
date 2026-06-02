<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, Lock } from 'lucide-vue-next'
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
const unlocked = ref(false)
const loading = ref(true)
const activeIndex = ref(0)
const rootRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

const results = computed(() => filterEntriesBySearch(entries.value, query.value, 12))

const showDropdown = computed(
  () => unlocked.value && query.value.trim().length > 0 && (results.value.length > 0 || !loading.value),
)

const showEmpty = computed(
  () => unlocked.value && query.value.trim().length > 0 && results.value.length === 0 && !loading.value,
)

async function refreshEntries(): Promise<void> {
  loading.value = true
  try {
    const status = await window.electronAPI?.getVaultStatus()
    unlocked.value = Boolean(status?.unlocked)
    if (unlocked.value) {
      entries.value = (await window.electronAPI?.listEntries()) ?? []
    } else {
      entries.value = []
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

function onSelectActive(): void {
  const entry = results.value[activeIndex.value]
  if (entry) void activateEntry(entry)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    window.electronAPI?.hideQuickBar?.()
    return
  }
  if (!showDropdown.value) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, results.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    onSelectActive()
  }
}

let removeShownListener: (() => void) | undefined

watch([query, results, showDropdown, showEmpty, unlocked], () => {
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
        <span v-if="query" class="quickbar-hint">{{ t('quickBar.hintNavigate') }}</span>
      </template>
      <button v-else type="button" class="quickbar-locked" @click="focusMain">
        <Lock :size="14" :stroke-width="1.75" />
        {{ t('quickBar.locked') }}
      </button>
    </div>

    <ul v-if="showDropdown && results.length" class="quickbar-results" role="listbox">
      <li
        v-for="(entry, index) in results"
        :key="entry.id"
        role="option"
        :aria-selected="index === activeIndex"
        class="quickbar-result"
        :class="{ 'quickbar-result--active': index === activeIndex }"
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
      </li>
    </ul>

    <p v-else-if="showEmpty" class="quickbar-empty">{{ t('quickBar.noMatch') }}</p>
    <ToastHost />
  </div>
</template>
