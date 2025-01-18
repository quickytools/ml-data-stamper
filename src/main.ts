import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { Quasar } from 'quasar'
import { dependencyGraph } from '@/plugin/dependencyGraph'

import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/src/css/index.sass'

const app = createApp(App)

app
  .use(router)
  .use(Quasar, {
    plugins: {},
  })
  .use(dependencyGraph)
  .mount('#app')
