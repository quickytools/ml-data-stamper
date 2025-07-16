import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    {
      path: '/bounding-box-editor',
      name: 'bounding-box-editor',
      component: () => import('../views/EditorView.vue'),
    },
    {
      path: '/load-video',
      name: 'load-video',
      component: () => import('../views/LoadVideoView.vue'),
    },
    // TODO Only when env is not production
    {
      path: '/inspect-db',
      name: 'inspect-db',
      component: () => import('../views/InspectDbView.vue'),
    },
  ],
})

export default router
