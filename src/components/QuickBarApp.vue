<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, Lock, X, Copy, Eye, EyeOff, ChevronLeft } from 'lucide-vue-next'
import CategoryIconView from '@/components/CategoryIconView.vue'
import SearchHighlightText from '@/components/SearchHighlightText.vue'
import ToastHost from '@/components/ToastHost.vue'
import { syncLocaleFromStorage } from '@/composables/useLocale'
import { showToast } from '@/composables/useToast'
import { syncThemeFromStorage, useTheme } from '@/composables/useTheme'
import { filterEntriesBySearch } from '@/shared/entrySearch'
import { launchEntry } from '@/shared/launchEntry'
import {
  clampQuickBarRecentLimit,
  QUICK_BAR_RECENT_LIMIT_DEFAULT,
  QUICK_BAR_RESULTS_MAX_HEIGHT_PX,
} from '@/shared/quickBarLimits'
import { canRenderDisplayIcon } from '@/shared/presetIconAssets'
import { getAvatarMeta, parseErrorMessage } from '@/shared/utils'
import {
  generateTotpCode,
  getTotpRemainingSeconds,
  isValidTotpSecret,
  normalizeTotpSecret,
} from '@/shared/totp'
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
const listLimit = ref(QUICK_BAR_RECENT_LIMIT_DEFAULT)
const unlocked = ref(false)
const loading = ref(true)
const activeIndex = ref(0)
const rootRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const resultsListRef = ref<HTMLElement | null>(null)
const detailOpen = ref(false)
const detailEntry = computed(() => listItems.value[activeIndex.value] ?? null)
const passwordVisible = ref(false)
const detailFieldIndex = ref(0)
const detailTotpCode = ref('')
const detailTotpRemaining = ref(30)
let detailTotpTimer: ReturnType<typeof setInterval> | null = null
const detailFields = computed(() => {
  const entry = detailEntry.value
  if (!entry) return [] as Array<{ key: string; label: string; value: string; secret?: boolean }>
  const fields: Array<{ key: string; label: string; value: string; secret?: boolean }> = []
  if (entry.username) fields.push({ key: 'username', label: t('quickBar.username'), value: entry.username })
  if (entry.password) fields.push({ key: 'password', label: t('quickBar.password'), value: entry.password, secret: true })
  if (entry.url) fields.push({ key: 'url', label: t('quickBar.url'), value: entry.url })
  if (entry.note) fields.push({ key: 'note', label: t('quickBar.note'), value: entry.note })
  if (entry.totpSecret) {
    fields.push({ key: 'totp', label: t('quickBar.totpSecret'), value: entry.totpSecret })
    if (detailTotpCode.value) {
      fields.push({ key: 'totp-code', label: t('quickBar.totpCode'), value: detailTotpCode.value })
    }
  }
  entry.customFields.forEach((field, index) => {
    if (field.value) fields.push({ key: `custom-${index}`, label: field.name, value: field.value })
  })
  return fields
})

const results = computed(() =>
  filterEntriesBySearch(entries.value, query.value, listLimit.value),
)

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
      const settings = await api?.getSettings()
      listLimit.value = clampQuickBarRecentLimit(
        settings?.quickBarRecentLimit ?? QUICK_BAR_RECENT_LIMIT_DEFAULT,
      )
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

function setDetailOpen(open: boolean): void {
  detailOpen.value = open && Boolean(detailEntry.value)
  detailFieldIndex.value = 0
  passwordVisible.value = false
  if (open) {
    void refreshDetailTotp()
    if (!detailTotpTimer) detailTotpTimer = setInterval(() => void refreshDetailTotp(), 1000)
  } else if (detailTotpTimer) {
    clearInterval(detailTotpTimer)
    detailTotpTimer = null
    detailTotpCode.value = ''
  }
  window.electronAPI?.setQuickBarDetailOpen?.(detailOpen.value)
  reportHeight()
}

async function refreshDetailTotp(): Promise<void> {
  const secret = normalizeTotpSecret(detailEntry.value?.totpSecret ?? '')
  if (!detailOpen.value || !isValidTotpSecret(secret)) {
    detailTotpCode.value = ''
    detailTotpRemaining.value = 30
    return
  }
  detailTotpRemaining.value = getTotpRemainingSeconds()
  try {
    detailTotpCode.value = await generateTotpCode(secret)
  } catch {
    detailTotpCode.value = ''
  }
}

function copyActiveDetailField(): void {
  const field = detailFields.value[detailFieldIndex.value]
  if (field) void copyDetailValue(field.label, field.value)
}

async function copyDetailValue(label: string, value: string): Promise<void> {
  if (!value) return
  try {
    await window.electronAPI?.copySecret(value)
    showToast(t('quickBar.copied', { label }), 'success')
  } catch (error) {
    showToast(parseErrorMessage(error), 'error')
  }
}

function scrollActiveIntoView(): void {
  nextTick(() => {
    const active = resultsListRef.value?.querySelector('.quickbar-result--active')
    if (active instanceof HTMLElement) {
      active.scrollIntoView({ block: 'nearest' })
    }
  })
}

function focusMain(): void {
  window.electronAPI?.quickBarShowMain?.()
  window.electronAPI?.hideQuickBar?.()
}

async function activateEntry(entry: PasswordEntry): Promise<void> {
  const api = window.electronAPI
  if (!api?.openLocalProgram || !api.openExternal || !api.touchEntry) return
  try {
    await launchEntry(entry, {
      openLocalProgram: (programPath) => api.openLocalProgram(programPath),
      openExternal: (url) => api.openExternal(url),
      touchEntry: (entryId) => api.touchEntry(entryId),
      focusEntryInMain: (entryId) => api.quickBarFocusEntry?.(entryId),
    })
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
  if (event.key === 'ArrowLeft' && detailOpen.value) {
    event.preventDefault()
    setDetailOpen(false)
    inputRef.value?.focus()
    return
  }
  if (event.key === 'ArrowRight' && listItems.value.length) {
    event.preventDefault()
    setDetailOpen(true)
    return
  }
  if (detailOpen.value) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      detailFieldIndex.value = Math.min(detailFieldIndex.value + 1, detailFields.value.length - 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      detailFieldIndex.value = Math.max(detailFieldIndex.value - 1, 0)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      copyActiveDetailField()
    }
    return
  }
  if (!listItems.value.length) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, listItems.value.length - 1)
    scrollActiveIntoView()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
    scrollActiveIntoView()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    onSelectActive()
  }
}

let removeShownListener: (() => void) | undefined

watch([query, listItems, showList, showEmpty, unlocked], () => {
  activeIndex.value = 0
  if (detailOpen.value && !detailEntry.value) setDetailOpen(false)
  passwordVisible.value = false
  reportHeight()
})

watch(detailEntry, () => {
  detailFieldIndex.value = 0
  passwordVisible.value = false
  if (detailOpen.value) void refreshDetailTotp()
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
      setDetailOpen(false)
      reportHeight()
      inputRef.value?.focus()
    })
  })
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  removeShownListener?.()
  document.removeEventListener('keydown', onKeydown)
  if (detailTotpTimer) clearInterval(detailTotpTimer)
})
</script>

<template>
  <div
    ref="rootRef"
    class="quickbar-root"
    :class="{ 'quickbar-root--animal': isAnimalIsland }"
  >
    <div class="quickbar-layout" :class="{ 'quickbar-layout--detail': detailOpen }">
      <div class="quickbar-primary">
      <div class="quickbar-strip">
      <Search
        class="quickbar-search-icon"
        :size="16"
        :stroke-width="1.75"
      />
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
        >
        <span
          v-if="query || showRecent"
          class="quickbar-hint"
        >{{ t('quickBar.hintNavigate') }}</span>
      </template>
      <button
        v-else
        type="button"
        class="quickbar-locked"
        @click="focusMain"
      >
        <Lock
          :size="14"
          :stroke-width="1.75"
        />
        {{ t('quickBar.locked') }}
      </button>
      </div>

      <p
      v-if="showRecent"
      class="quickbar-section-label"
    >
      {{ t('quickBar.recentOpened') }}
      </p>

      <ul
      v-if="showList && listItems.length"
      ref="resultsListRef"
      class="quickbar-results"
      :class="{ 'quickbar-results--top-border': !showRecent }"
      :style="{ maxHeight: `${QUICK_BAR_RESULTS_MAX_HEIGHT_PX}px` }"
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
            v-if="canRenderDisplayIcon(entry.displayIcon)"
            :name="entry.displayIcon"
            :size="14"
          />
          <span
            v-else
            class="quickbar-avatar-letter"
            :style="{
              background: getAvatarMeta(entry.title).bg,
              color: getAvatarMeta(entry.title).color,
            }"
          >
            {{ getAvatarMeta(entry.title).text }}
          </span>
        </span>
        <span class="quickbar-result-main">
          <span class="quickbar-result-title">
            <SearchHighlightText
              v-if="query.trim()"
              :text="entry.title"
              :query="query"
            />
            <template v-else>{{ entry.title }}</template>
          </span>
          <span class="quickbar-result-meta">
            <SearchHighlightText
              v-if="query.trim() && entry.username"
              :text="entry.username"
              :query="query"
            />
            <template v-else>{{ entry.username || t('vault.noAccount') }}</template>
            <template v-if="entry.categoryName">
              ·
              <SearchHighlightText
                v-if="query.trim()"
                :text="entry.categoryName"
                :query="query"
              />
              <template v-else>{{ entry.categoryName }}</template>
            </template>
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
          <X
            :size="14"
            :stroke-width="2"
          />
        </button>
      </li>
      </ul>

      <p
      v-else-if="showEmpty"
      class="quickbar-empty"
    >
      {{ t('quickBar.noMatch') }}
      </p>
      </div>
      <aside v-if="detailOpen && detailEntry" class="quickbar-detail" aria-label="Entry details">
        <div class="quickbar-detail-header">
          <div class="quickbar-detail-heading">
            <span class="quickbar-detail-title">{{ detailEntry.title }}</span>
            <span class="quickbar-detail-subtitle">{{ t('quickBar.details') }}</span>
          </div>
          <button type="button" class="quickbar-icon-button" :title="t('quickBar.closeDetails')" :aria-label="t('quickBar.closeDetails')" @mousedown.prevent.stop="setDetailOpen(false)">
            <ChevronLeft :size="16" />
          </button>
        </div>
        <div class="quickbar-detail-fields">
          <div v-if="detailEntry.username" class="quickbar-detail-field" :class="{ 'quickbar-detail-field--active': detailFields[detailFieldIndex]?.key === 'username' }" @mouseenter="detailFieldIndex = detailFields.findIndex((field) => field.key === 'username')">
            <span class="quickbar-detail-label">{{ t('quickBar.username') }}</span>
            <span class="quickbar-detail-value">{{ detailEntry.username }}</span>
            <button type="button" class="quickbar-icon-button" :title="t('quickBar.copy')" :aria-label="t('quickBar.copy')" @mousedown.prevent.stop="copyDetailValue(t('quickBar.username'), detailEntry.username)"><Copy :size="14" /></button>
          </div>
          <div v-if="detailEntry.password" class="quickbar-detail-field" :class="{ 'quickbar-detail-field--active': detailFields[detailFieldIndex]?.key === 'password' }" @mouseenter="detailFieldIndex = detailFields.findIndex((field) => field.key === 'password')">
            <span class="quickbar-detail-label">{{ t('quickBar.password') }}</span>
            <span class="quickbar-detail-value quickbar-detail-value--secret">{{ passwordVisible ? detailEntry.password : '••••••••' }}</span>
            <button type="button" class="quickbar-icon-button" :title="passwordVisible ? t('quickBar.hidePassword') : t('quickBar.showPassword')" :aria-label="passwordVisible ? t('quickBar.hidePassword') : t('quickBar.showPassword')" @mousedown.prevent.stop="passwordVisible = !passwordVisible">
              <EyeOff v-if="passwordVisible" :size="14" /><Eye v-else :size="14" />
            </button>
            <button type="button" class="quickbar-icon-button" :title="t('quickBar.copy')" :aria-label="t('quickBar.copy')" @mousedown.prevent.stop="copyDetailValue(t('quickBar.password'), detailEntry.password)"><Copy :size="14" /></button>
          </div>
          <div v-if="detailEntry.url" class="quickbar-detail-field" :class="{ 'quickbar-detail-field--active': detailFields[detailFieldIndex]?.key === 'url' }" @mouseenter="detailFieldIndex = detailFields.findIndex((field) => field.key === 'url')">
            <span class="quickbar-detail-label">{{ t('quickBar.url') }}</span>
            <span class="quickbar-detail-value">{{ detailEntry.url }}</span>
            <button type="button" class="quickbar-icon-button" :title="t('quickBar.copy')" :aria-label="t('quickBar.copy')" @mousedown.prevent.stop="copyDetailValue(t('quickBar.url'), detailEntry.url)"><Copy :size="14" /></button>
          </div>
          <div v-if="detailEntry.note" class="quickbar-detail-field quickbar-detail-field--multiline" :class="{ 'quickbar-detail-field--active': detailFields[detailFieldIndex]?.key === 'note' }" @mouseenter="detailFieldIndex = detailFields.findIndex((field) => field.key === 'note')">
            <span class="quickbar-detail-label">{{ t('quickBar.note') }}</span>
            <span class="quickbar-detail-value">{{ detailEntry.note }}</span>
            <button type="button" class="quickbar-icon-button" :title="t('quickBar.copy')" :aria-label="t('quickBar.copy')" @mousedown.prevent.stop="copyDetailValue(t('quickBar.note'), detailEntry.note)"><Copy :size="14" /></button>
          </div>
          <div v-if="detailEntry.totpSecret" class="quickbar-detail-field" :class="{ 'quickbar-detail-field--active': detailFields[detailFieldIndex]?.key === 'totp' }" @mouseenter="detailFieldIndex = detailFields.findIndex((field) => field.key === 'totp')">
            <span class="quickbar-detail-label">{{ t('quickBar.totpSecret') }}</span>
            <span class="quickbar-detail-value">{{ detailEntry.totpSecret }}</span>
            <button type="button" class="quickbar-icon-button" :title="t('quickBar.copy')" :aria-label="t('quickBar.copy')" @mousedown.prevent.stop="copyDetailValue(t('quickBar.totpSecret'), detailEntry.totpSecret)"><Copy :size="14" /></button>
          </div>
          <div v-if="detailTotpCode" class="quickbar-detail-field quickbar-detail-field--totp" :class="{ 'quickbar-detail-field--active': detailFields[detailFieldIndex]?.key === 'totp-code' }" @mouseenter="detailFieldIndex = detailFields.findIndex((field) => field.key === 'totp-code')">
            <span class="quickbar-detail-label">{{ t('quickBar.totpCode') }}</span>
            <span class="quickbar-detail-value quickbar-detail-value--code">{{ detailTotpCode }} <small>{{ t('quickBar.totpRemaining', { seconds: detailTotpRemaining }) }}</small></span>
            <button type="button" class="quickbar-icon-button" :title="t('quickBar.copy')" :aria-label="t('quickBar.copy')" @mousedown.prevent.stop="copyDetailValue(t('quickBar.totpCode'), detailTotpCode)"><Copy :size="14" /></button>
          </div>
          <template v-for="field in detailEntry.customFields" :key="field.name">
            <div v-if="field.value" class="quickbar-detail-field" :class="{ 'quickbar-detail-field--active': detailFields[detailFieldIndex]?.key === `custom-${detailEntry.customFields.indexOf(field)}` }" @mouseenter="detailFieldIndex = detailFields.findIndex((item) => item.key === `custom-${detailEntry.customFields.indexOf(field)}`)">
              <span class="quickbar-detail-label">{{ field.name }}</span>
              <span class="quickbar-detail-value">{{ field.value }}</span>
              <button type="button" class="quickbar-icon-button" :title="t('quickBar.copy')" :aria-label="t('quickBar.copy')" @mousedown.prevent.stop="copyDetailValue(field.name, field.value)"><Copy :size="14" /></button>
            </div>
          </template>
        </div>
      </aside>
    </div>
    <ToastHost />
  </div>
</template>
