<script setup lang="ts">
import { useTemplateRef, ref, watch, inject } from 'vue'
import { Subject, merge } from 'rxjs'
import { map } from 'rxjs/operators'
import { useObservable } from '@vueuse/rxjs'
import debounce from 'lodash.debounce'
import type { VideoDescription } from '@/types/VideoDescription'

import type { ImageContent } from '@/models/ImageContent'

import { ClientSideVideoLoader } from '../video-load/ClientSideVideoLoader'

import { YoloObjectDetector } from '../object-detection/YoloObjectDetector'

const props = defineProps({
  // true emits video data as event false renders frame in component camvas
  isEventEmitter: {
    type: Boolean,
    default: false,
  },
  column: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits<{
  /**
   * Video is loaded
   */
  videoLoad: VideoDescription
  /**
   * On video data load and frame change the frame content is broadcasted
   */
  frameChange: ImageContent
}>()

const sourceVideoRepository = inject('source-video-repository')

const fileInput = useTemplateRef('file')
const loadingFileCount = ref(0)

const videoCanvas = ref()
const videoCanvasWidth = ref(0)
const videoCanvasHeight = ref(0)

const sliderFrameIndex = ref(0)

const videoSrc = ref('')

const videoFrames = ref([])
let videoSignature = ''

const videoDataSubject = new Subject()

const isLoadingDetector = ref(false)
const isDetectingObjects = ref(false)

const objectDetector = new YoloObjectDetector()
// TODO Remove listeners as well
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
        return data
      }

      return {}
    }),
  ),
)

const detectOnCanvas = async () => {
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
}

const debounceDetectOnCanvas = debounce(detectOnCanvas, 300)

const loadFrame = (index, frames) => {
  if (frames && index >= 0 && index < frames.length) {
    const frame = frames[index]
    if (props.isEventEmitter) {
      emit('frameChange', {
        // TODO File data including signature, frame, ...
        content: frame.content,
        width: videoCanvasWidth.value,
        height: videoCanvasHeight.value,
        identifier: {
          id: videoSignature,
          index: index,
        },
      })
    } else {
      const ctx = videoCanvas.value.getContext('2d')
      ctx.putImageData(frame.content, 0, 0)

      // TODO Improve structure
      loadDetector().then(debounceDetectOnCanvas)
    }
  }
}

watch(seekVideoData, (value, prev) => {
  const { width, height, frames, orientation, fileSignature: signature } = value

  if (!props.isEventEmitter) {
    const canvas = videoCanvas.value
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  if (frames?.length > 0) {
    videoCanvasWidth.value = width
    videoCanvasHeight.value = height
    videoFrames.value = frames
    videoSignature = signature
    // TODO Find canvas resize or similar event
    setTimeout(async () => {
      sliderFrameIndex.value = 0
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
    loadingFileCount.value += 1
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
        emit('videoLoad', videoDescription)
      } catch (e) {
        console.error(e)
      } finally {
        loadingFileCount.value -= 1
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
    div.q-py-sm.row.q-gutter-md(:class="{column: props.column}")
      input#file(:disabled="loadingFileCount>0" type="file" multiple @change='onFileChange')
      q-circular-progress(v-if="loadingFileCount>0"
                          indeterminate
                          size="24px"
                          color="primary"
      )
      q-slider.frame-seeker.col(
        v-if="videoFrames.length>0"
        v-model="sliderFrameIndex"
        :min="0"
        :max="videoFrames.length"
        label-always
        switch-label-side
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
@/models/imageContent
