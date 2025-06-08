<script setup lang="ts">
import { useTemplateRef, ref, watch, inject, onMounted, toRaw } from 'vue'
import { Subject, merge } from 'rxjs'
import { map } from 'rxjs/operators'
import { useObservable } from '@vueuse/rxjs'

import { ClientSideVideoLoader } from '../video-load/ClientSideVideoLoader'
import { useVideoStore } from '../stores/videoStore'

// TODO Refactor loading video data, rendering frame data
import { pipeline, RawImage } from '@huggingface/transformers'
import { YoloObjectDetector } from '../object-detection/YoloObjectDetector'

const sourceVideoRepository = inject('source-video-repository')

const fileInput = useTemplateRef('file')
const videoCanvas = ref()
const videoCanvasWidth = ref(0)
const videoCanvasHeight = ref(0)
const sliderFrameIndex = ref(0)
const videoStore = useVideoStore()

const videoSrc = ref('')

interface VideoFrame {
content: ImageData
timestamp: number
duration: number
}

const videoFrames = ref<VideoFrame[]>([])

const videoDataSubject = new Subject()

let canvasRotation = 0

const isLoadingDetector = ref(false)
const isDetectingObjects = ref(false)

// TODO Enable/disable UI accordingly (while loading)

const objectDetector = new YoloObjectDetector()
objectDetector.addEventListener('loading', ({ detail }) => {
  isLoadingDetector.value = detail
})
objectDetector.addEventListener('detecting', ({ detail }) => {
  isDetectingObjects.value = detail
})

const loadDetector = async () => {
  await objectDetector.load()
}

const detectObjects = async (imageData) => {
  return objectDetector.detect(imageData)
}

const seekVideoData = useObservable(
  videoDataSubject.pipe(
    map((data) => {
      const videoFrameCount = data.frames.length
      if (videoFrameCount) {
        const { config, orientation } = data
        const isRotated = (orientation / 90) % 2 == 1
        const width = isRotated ? config.codedHeight : config.codedWidth
        const height = isRotated ? config.codedWidth : config.codedHeight
        return { ...data, width, height }
      }

      return {}
    }),
  ),
)

const loadFrame = (index, frames) => {
  if (frames && index >= 0 && index < frames.length) {
    const ctx = videoCanvas.value.getContext('2d')
    const frame = frames[index]
    ctx.putImageData(frame.content, 0, 0)
  }
}

watch(seekVideoData, (value, prev) => {
  const { width, height, frames, orientation } = value

  const canvas = videoCanvas.value
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (frames?.length > 0) {
    videoCanvasWidth.value = width
    videoCanvasHeight.value = height
    videoFrames.value = frames
    canvasRotation = (orientation * Math.PI) / 180
    // TODO Find canvas resize or similar event
    setTimeout(async () => {
      loadFrame(0, frames)
      const bitMapConversion = await createImageBitmap(frames[0].content)// pull video frames in this location. This is where each fram gets displayed in the LoadVideo page
      videoStore.setVideoFrame(0, bitMapConversion)
    }, 100)
  }
})

watch(sliderFrameIndex, async (index) => {
  loadFrame(index, videoFrames.value)
  const frame = videoFrames.value[index]

  // Debug logs to inspect the frame and its content
  const realImageData = toRaw(frame)
  const rawContent = toRaw(frame.content)
  console.log("Frame at index", index, "is", realImageData)
  console.log("Frame.content is", rawContent)
  console.log("Type of raw content is", typeof realImageData)
  console.log("Type of frame.content is", typeof frame)
  if (rawContent) {
    try{
    const bitMapConversion = await createImageBitmap(rawContent) // another location for frames to be out putted to LoadVideo, perhaps the first frame
    videoStore.setVideoFrame(index, bitMapConversion)
    }
    catch(error){
      console.error("failed to create imageBitMap from frame.content: ", error)
    }
  }
})

const onFileChange = (e) => {
  const files = e.target.files
  if (files.length) {
    const videoFile = files[0]

    new Promise(async (resolve) => {
      const videoData = await new ClientSideVideoLoader().load(videoFile)

      try {
        const videoDescription = {
          fileName: videoData.file.name,
          sizeBytes: videoData.file.size,
          signature: videoData.fileSignature,
          frameCount: videoData.frameCount,
          frameRate: videoData.frameRate,
          orientationDegrees: videoData.orientation,
        }
        // TODO This is failing
        const saved = await sourceVideoRepository.saveVideo(videoDescription)
        console.log('save video data', videoData, saved)
      } catch (e) {
        console.error(e)
      }
      videoStore.setVideoStore(videoData)
      videoDataSubject.next(videoData)
    })
  }
}

onMounted(() => {
  // TODO Demonstrates object detection on URL image. Delete once detection on video frames is complete.
  // loadDetector().then(async () => {
  //   const tennisImage =
  //     'https://static.nike.com/a/images/f_auto/dpr_3.0,cs_srgb/h_484,c_limit/193ecef7-04df-45a4-a9aa-0643cf7ba4be/how-to-teach-the-tennis-serve-to-adults.jpg'
  //   const detected = await detectObjects(tennisImage)
  //   console.log('detected', detected)
  // })
})
</script>

<template lang="pug">
div.column
  form
    div.q-py-sm.row.q-gutter-md
      label(for="file") File
      input#file(type="file" multiple @change='onFileChange')
      q-slider.frame-seeker.col(
        v-model="sliderFrameIndex"
        :min="0"
        :max="videoFrames.length"
        label-always
        switch-label-side
        v-if="videoFrames.length>0"
      )
  canvas(ref="videoCanvas" :width='videoCanvasWidth' :height='videoCanvasHeight')
</template>

<style scoped>
/* TODO Better styling */
.frame-seeker {
  max-width: 600px;
}
</style>
