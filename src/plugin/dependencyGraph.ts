import type { App } from 'vue'
import * as sourceVideoRepository from '@/repositories/sourceVideoRepository'

export const dependencyGraph = {
  install(app: App) {
    app.provide('source-video-repository', sourceVideoRepository)
  },
}
