import { createApp } from 'vue'
import ClipboardWindowApp from '@/components/ClipboardWindowApp.vue'
import '@/assets/styles/global.css'
import '@/assets/styles/clipboard-window.css'
import { bindSystemThemeListener, bindThemeStorageSync, initTheme, syncThemeFromStorage } from '@/composables/useTheme'
import { bindLocaleStorageSync, initLocale, syncLocaleFromStorage } from '@/composables/useLocale'
import { i18n } from '@/i18n'

initTheme()
initLocale()
bindThemeStorageSync()
bindLocaleStorageSync()
bindSystemThemeListener()
window.electronAPI?.onThemeChanged?.(() => {
  syncThemeFromStorage()
  syncLocaleFromStorage()
})
createApp(ClipboardWindowApp).use(i18n).mount('#app')
