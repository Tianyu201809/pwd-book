import { createApp } from 'vue'
import DetailWindowApp from '@/components/DetailWindowApp.vue'
import '@/assets/styles/global.css'
import 'animal-island-vue/style'
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

function refreshDetailWindowChrome(): void {
  syncThemeFromStorage()
  syncLocaleFromStorage()
}

window.electronAPI?.onThemeChanged?.(() => {
  refreshDetailWindowChrome()
})

const app = createApp(DetailWindowApp)
app.use(i18n)
app.mount('#app')
