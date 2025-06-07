import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useVideoStore = defineStore('video', {
  state: () => ({
    videoData: null,
    frameIndex: 0,
    currentFrame: null,
  }),
  actions: {
    setVideoStore(data) {
      this.videoData = data
    },
    setVideoFrame(index, frame) {
      this.frameIndex = index
      this.currentFrame = frame
    },
  },
})
