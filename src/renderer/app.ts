import { createApp } from 'vue'
import App from '@/App.vue'
import '@/assets/styles/global.css'
import 'animal-island-vue/style'
import { initTheme } from '@/composables/useTheme'
import { initLocale } from '@/composables/useLocale'
import { i18n } from '@/i18n'

initTheme()
initLocale()

const app = createApp(App)
app.use(i18n)
app.mount('#app')
