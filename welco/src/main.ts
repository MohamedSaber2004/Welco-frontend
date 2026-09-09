import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initI18n } from './i18n'
import { applyRoleTheme } from './utils/role'
import { applyAuthGatedTheme } from './application/theme.service'

import AppImage from './components/ui/AppImage.vue'

initI18n()
applyRoleTheme()
applyAuthGatedTheme()

const app = createApp(App)
app.component('AppImage', AppImage)
app.use(router)
app.mount('#app')
