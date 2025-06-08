import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useVideoStore = defineStore('video', {
  state: () => ({
    videoData: null,
    frameIndex: 0,
    currentFrame: null as ImageBitmap | null,
  }),
  actions: {
    setVideoStore(data) {
      this.videoData = data
    },
    setVideoFrame(index:number, frame: ImageBitmap | null) {
      this.frameIndex = index
      this.currentFrame = frame
    },
  },
})
