import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initI18n } from './i18n'
import { applyRoleTheme } from './utils/role'
import { applyAuthGatedTheme } from './application/theme.service'

initI18n()
applyRoleTheme()
applyAuthGatedTheme()

const app = createApp(App)
app.use(router)
app.mount('#app')
