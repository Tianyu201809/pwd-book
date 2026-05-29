import { ref, watch } from 'vue'
import {
  applyDocumentLocale,
  i18n,
  LOCALE_OPTIONS,
  LOCALE_STORAGE_KEY,
  readStoredLocale,
  type AppLocale,
} from '@/i18n'

const locale = ref<AppLocale>(readStoredLocale())

watch(
  locale,
  (next) => {
    i18n.global.locale.value = next
    localStorage.setItem(LOCALE_STORAGE_KEY, next)
    applyDocumentLocale(next)
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

export function useLocale() {
  function setLocale(next: AppLocale): void {
    locale.value = next
  }

  return {
    locale,
    localeOptions: LOCALE_OPTIONS,
    setLocale,
  }
}
