<script setup lang="ts">
import {
  useTemplateRef,
  ref,
  watch,
  inject,
  onMounted,
  defineProps,
  defineEmits,
  defineExpose,
} from 'vue'
import { Subject, merge } from 'rxjs'
import { map } from 'rxjs/operators'
import { useObservable } from '@vueuse/rxjs'

import { ClientSideVideoLoader } from '../video-load/ClientSideVideoLoader'

import { YoloObjectDetector } from '../object-detection/YoloObjectDetector'

const props = defineProps({
  isEventEmitter: {
    type: Boolean,
    default: false,
  }, // true emits video data as event false renders frame in component camvas
})

const emit = defineEmits<{
  /**
   * On video data load and frame change the frame content, frame width, and frame height is emitted.
   */
  frameChange: [content: any, width: number, height: number]
}>()

const sourceVideoRepository = inject('source-video-repository')

const fileInput = useTemplateRef('file')
const videoCanvas = ref()
const videoCanvasWidth = ref(0)
const videoCanvasHeight = ref(0)
const sliderFrameIndex = ref(0)

const videoSrc = ref('')

const videoFrames = ref([])

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
    const frame = frames[index]
    if (props.isEventEmitter) {
      emit('frameChange', {
        content: frame.content,
        width: videoCanvasWidth.value,
        height: videoCanvasHeight.value,
      })
    } else {
      const ctx = videoCanvas.value.getContext('2d')
      ctx.putImageData(frame.content, 0, 0)

      // TODO Improve structure
      loadDetector().then(async () => {
        const detected = await detectObjects(videoCanvas.value)
        const detectedSportsBall = detected
          .filter(({ score, label }) => label == 'sports ball' && score > 0.9)
          .sort((a, b) => b.score - a.score)
        if (detectedSportsBall.length) {
          const firstDetection = detectedSportsBall[0]
          console.log('Highest confidence detection', firstDetection.box, firstDetection)
        } else {
          console.log('High confidence sports ball not detected', detected)
        }
      })
    }
  }
}

watch(seekVideoData, (value, prev) => {
  const { width, height, frames, orientation } = value

  if (!props.isEventEmitter) {
    const canvas = videoCanvas.value
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  if (frames?.length > 0) {
    videoCanvasWidth.value = width
    videoCanvasHeight.value = height
    videoFrames.value = frames
    canvasRotation = (orientation * Math.PI) / 180
    // TODO Find canvas resize or similar event
    setTimeout(async () => {
      loadFrame(0, frames)
    }, 100)
  }
})

watch(sliderFrameIndex, async (index) => {
  loadFrame(index, videoFrames.value)
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
      videoDataSubject.next(videoData)
    })
  }
}

const sampleDetection = () => {
  loadDetector().then(async () => {
    const tennisImage =
      'https://static.nike.com/a/images/f_auto/dpr_3.0,cs_srgb/h_484,c_limit/193ecef7-04df-45a4-a9aa-0643cf7ba4be/how-to-teach-the-tennis-serve-to-adults.jpg'
    const detected = await detectObjects(tennisImage)
    console.log('detected', detected)
  })
}

onMounted(() => {
  // TODO Demonstrates object detection on URL image. Delete once detection on video frames is complete.
  // sampleDetection()
})

const changeFrame = (delta) => {
  if (delta) {
    sliderFrameIndex.value = Math.max(
      0,
      Math.min(videoFrames.value.length, sliderFrameIndex.value + delta),
    )
  }
}

defineExpose({ changeFrame })
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
  canvas(ref="videoCanvas"
  v-if="!props.isEventEmitter"
  :width='videoCanvasWidth'
  :height='videoCanvasHeight'

  )
</template>

<style scoped>
/* TODO Better styling */
.frame-seeker {
  min-width: 200px;
  max-width: 600px;
}
</style>
