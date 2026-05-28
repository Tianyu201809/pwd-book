import { createApp } from 'vue'
import App from '@/App.vue'
import '@/assets/styles/global.css'
import { initTheme } from '@/composables/useTheme'

initTheme()

createApp(App).mount('#app')
