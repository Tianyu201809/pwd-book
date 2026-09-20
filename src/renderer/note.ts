import { createApp } from 'vue'
import '@/assets/styles/global.css'
import 'animal-island-vue/style'
import StickyNoteApp from '@/components/notes/StickyNoteApp.vue'
import { bindSystemThemeListener, bindThemeStorageSync, initTheme, syncThemeFromStorage } from '@/composables/useTheme'
import { bindLocaleStorageSync, initLocale, syncLocaleFromStorage } from '@/composables/useLocale'
import { i18n } from '@/i18n'

initTheme(); initLocale(); bindThemeStorageSync(); bindLocaleStorageSync(); bindSystemThemeListener()
window.electronAPI?.onThemeChanged?.(() => { syncThemeFromStorage(); syncLocaleFromStorage() })
createApp(StickyNoteApp).use(i18n).mount('#app')
