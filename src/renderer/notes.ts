import { createApp } from 'vue'
import '@/assets/styles/global.css'
import 'animal-island-vue/style'
import NotesManagerApp from '@/components/notes/NotesManagerApp.vue'
import { bindSystemThemeListener, bindThemeStorageSync, initTheme, syncThemeFromStorage } from '@/composables/useTheme'
import { bindLocaleStorageSync, initLocale, syncLocaleFromStorage } from '@/composables/useLocale'
import { i18n } from '@/i18n'

initTheme(); initLocale(); bindThemeStorageSync(); bindLocaleStorageSync(); bindSystemThemeListener()
window.electronAPI?.onThemeChanged?.(() => { syncThemeFromStorage(); syncLocaleFromStorage() })
createApp(NotesManagerApp).use(i18n).mount('#app')
