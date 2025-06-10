import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { Quasar } from 'quasar'
import { dependencyGraph } from '@/plugin/dependencyGraph'
import { migratePglite } from './db/migrate'

import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/src/css/index.sass'
import { createPinia } from 'pinia'

const app = createApp(App)
const pinia = createPinia()

app
  .use(router)
  .use(Quasar, {
    plugins: {},
  })
  .use(dependencyGraph)
  .use(pinia)
migratePglite().then(() => app.mount('#app'))
