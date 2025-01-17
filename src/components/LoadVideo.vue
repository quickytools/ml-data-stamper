<script setup lang="ts">
import { useTemplateRef, ref, watch } from 'vue'
import getVideoFrames from 'https://deno.land/x/get_video_frames@v0.0.10/mod.js'
import { Subject, merge } from 'rxjs'
import { map } from 'rxjs/operators'
import { useObservable } from '@vueuse/rxjs'

const fileInput = useTemplateRef('file')
const videoCanvas = ref()
const videoCanvasWidth = ref(0)
const videoCanvasHeight = ref(0)
const sliderFrameCount = ref(0)
const sliderFrameIndex = ref(0)

const videoDataSubject = new Subject()

const videoFrames = ref([])

// TODO Enable/disable UI accordingly (while loading)

const seekVideoData = useObservable(
  videoDataSubject.pipe(
    map((data) => {
      const videoFrameCount = data.frames.length
      if (videoFrameCount) {
        const { config } = data
        const width = config.codedWidth
        const height = config.codedHeight
        const endTime = data.frames[data.frames.length - 1].timestamp / 1e6
        // TODO Research if this is accurate
        const fps = videoFrameCount / endTime
        return {
          ...data,
          width,
          height,
          endTime,
          fps,
        }
      }

      return {}
    }),
  ),
)

const loadFrame = (index) => {
  const frames = videoFrames.value
  if (frames && index < frames.length) {
    const ctx = videoCanvas.value.getContext('2d')
    const frame = frames[index]
    ctx.putImageData(frame.content, 0, 0)
  }
}

watch(seekVideoData, (value, prev) => {
  const { width, height, frames } = value
  if (frames?.length > 0) {
    videoCanvasWidth.value = width
    videoCanvasHeight.value = height
    sliderFrameCount.value = frames.length
    videoFrames.value = frames
    loadFrame(0)
  }
})

watch(sliderFrameIndex, (index) => {
  loadFrame(index)
})

const getFileSignature = async (videoFile) => {
  const blob = new Blob([videoFile])
  const buffer = await blob.arrayBuffer()
  const messsage = new Uint8Array(buffer)
  const hashBuffer = await crypto.subtle.digest('SHA-256', messsage)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

const loadVideo = async (fileSignature, videoFile) => {
  const videoUrl = URL.createObjectURL(videoFile)
  const videoData = {
    file: videoFile,
    frames: [],
    config: null,
  }
  return getVideoFrames({
    videoUrl,
    async onFrame(frame) {
      // TODO Reuse canvases (clearing previously used)
      const canvas = document.createElement('canvas')
      const width = videoData.config.codedWidth
      const height = videoData.config.codedHeight
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(frame, 0, 0, width, height)
      const imageData = ctx.getImageData(0, 0, width, height)

      const buffer = new Uint8Array(frame.allocationSize())
      const layout = await frame.copyTo(buffer)
      const { duration, timestamp } = frame
      videoData.frames.push({
        content: imageData,
        timestamp,
        duration,
      })
      frame.close()
    },
    onConfig(config) {
      videoData.config = config
    },
  }).then(() => {
    URL.revokeObjectURL(videoFile)
    return {
      signature: fileSignature,
      ...videoData,
    }
  })
}

const onFileChange = (e) => {
  const files = e.target.files
  if (files.length) {
    const videoFile = files[0]
    getFileSignature(videoFile)
      .then((signature) => loadVideo(signature, videoFile))
      .then((videoData) => {
        const { config } = videoData
        videoDataSubject.next(videoData)
      })
  }
}
</script>

<template lang="pug">
form
  label(for="file") File
  input#file(type="file" multiple @change='onFileChange')
q-slider.frame-seeker(v-model="sliderFrameIndex"
                      :min="0"
                      :max="sliderFrameCount"
                      label-always
                      v-if="sliderFrameCount>0"
                      )
canvas(ref="videoCanvas" :width='videoCanvasWidth' :height='videoCanvasHeight')
</template>

<style scoped>
/* TODO Better styling */
.frame-seeker {
  max-width: 600px;
}
</style>
