import { ref, watch } from 'vue'
import {
  applyDocumentLocale,
  i18n,
  LOCALE_OPTIONS,
  LOCALE_STORAGE_KEY,
  readStoredLocale,
  type AppLocale,
} from '@/i18n'
import { vaultApi } from '@/services/vaultApi'

const locale = ref<AppLocale>(readStoredLocale())

watch(
  locale,
  (next) => {
    i18n.global.locale.value = next
    localStorage.setItem(LOCALE_STORAGE_KEY, next)
    applyDocumentLocale(next)
    void vaultApi.setUiLocale(next).catch(() => {})
  },
  { immediate: true },
)

export function initLocale(): void {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
  if (!stored) {
    const detected = navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
    locale.value = detected
    return
  }
  locale.value = readStoredLocale()
  applyDocumentLocale(locale.value)
}

export function syncLocaleFromStorage(): void {
  locale.value = readStoredLocale()
  i18n.global.locale.value = locale.value
  applyDocumentLocale(locale.value)
}

export function bindLocaleStorageSync(): () => void {
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== LOCALE_STORAGE_KEY) return
    syncLocaleFromStorage()
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}

function notifyQuickBarLocaleChanged(): void {
  window.electronAPI?.notifyThemeChanged?.()
}

export function useLocale() {
  function setLocale(next: AppLocale): void {
    locale.value = next
    notifyQuickBarLocaleChanged()
  }

  return {
    locale,
    localeOptions: LOCALE_OPTIONS,
    setLocale,
  }
}
