import { createApp } from 'vue'
import QuickBarApp from '@/components/QuickBarApp.vue'
import '@/assets/styles/global.css'
import 'animal-island-vue/style'
import '@/assets/styles/quickbar.css'
import {
  bindSystemThemeListener,
  bindThemeStorageSync,
  initTheme,
  syncThemeFromStorage,
} from '@/composables/useTheme'
import { bindLocaleStorageSync, initLocale, syncLocaleFromStorage } from '@/composables/useLocale'
import { i18n } from '@/i18n'

initTheme()
initLocale()
bindThemeStorageSync()
bindLocaleStorageSync()
bindSystemThemeListener()

function refreshQuickBarChrome(): void {
  syncThemeFromStorage()
  syncLocaleFromStorage()
}

window.electronAPI?.onThemeChanged?.(() => {
  refreshQuickBarChrome()
})

const app = createApp(QuickBarApp)
app.use(i18n)
app.mount('#app')
