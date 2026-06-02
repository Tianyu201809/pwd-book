import { createApp } from 'vue'
import QuickBarApp from '@/components/QuickBarApp.vue'
import '@/assets/styles/global.css'
import '@/assets/styles/quickbar.css'
import { initTheme } from '@/composables/useTheme'
import { initLocale } from '@/composables/useLocale'
import { i18n } from '@/i18n'

initTheme()
initLocale()

const app = createApp(QuickBarApp)
app.use(i18n)
app.mount('#app')
