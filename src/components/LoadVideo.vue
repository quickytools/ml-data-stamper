<script setup lang="ts">
import { useTemplateRef, ref, watch, inject } from 'vue'
import getVideoFrames from 'https://deno.land/x/get_video_frames@v0.0.10/mod.js'
import { Subject, merge } from 'rxjs'
import { map } from 'rxjs/operators'
import { useObservable } from '@vueuse/rxjs'
import { getFileSignature } from '@/util/fileUtil'

const sourceVideoRepository = inject('source-video-repository')

const fileInput = useTemplateRef('file')
const videoCanvas = ref()
const videoCanvasWidth = ref(0)
const videoCanvasHeight = ref(0)
const sliderFrameIndex = ref(0)

const videoSrc = ref('')

const videoDataSubject = new Subject()

const videoFrames = ref([])
let canvasRotation = 0

// TODO Enable/disable UI accordingly (while loading)

const seekVideoData = useObservable(
  videoDataSubject.pipe(
    map((data) => {
      const videoFrameCount = data.frames.length
      if (videoFrameCount) {
        const { config, orientation } = data
        const isRotated = (orientation / 90) % 2 == 1
        const width = isRotated ? config.codedHeight : config.codedWidth
        const height = isRotated ? config.codedWidth : config.codedHeight
        return {
          ...data,
          width,
          height,
        }
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
    setTimeout(() => {
      loadFrame(0, frames)
    }, 100)
  }
})

watch(sliderFrameIndex, (index) => {
  loadFrame(index, videoFrames.value)
})

async function getMediaProperties(file) {
  const readChunk = async (chunkSize, offset) =>
    new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer())

  return new Promise((resolve) => {
    // TODO Package library rather than loading from CDN
    //      Can also defer loading until necessary
    MediaInfo.mediaInfoFactory({}, (mediainfo) => {
      mediainfo
        .analyzeData(file.size, readChunk)
        .then((info) => {
          const tracks = info.media.track
          const filterTrackType = (typeValue) => {
            const filtered = tracks.filter((trackInfo) => {
              const trackType = trackInfo['@type']
              return (
                trackType &&
                typeof trackType == 'string' &&
                trackType.toLowerCase() == typeValue.toLowerCase()
              )
            })
            return filtered.length ? filtered[0] : {}
          }
          const video = filterTrackType('video')
          const {
            Duration: duration,
            FrameRate: frameRate,
            FrameCount: frameCount,
            Rotation: rotationText,
          } = video
          mediainfo.close()

          let orientation = 0
          try {
            orientation = (parseInt(rotationText ?? '0') + 360) % 360
          } catch {}

          resolve({
            duration: duration,
            frameRate: frameRate,
            frameCount: frameCount,
            orientation,
          })
        })
        .catch((error) => {
          mediainfo.close()
          console.error(error)
        })
    })
  })
}

const getRotationMatrix = (rotationDegrees, w, h) => {
  if (rotationDegrees != 0) {
    const rotateRadians = (rotationDegrees * Math.PI) / 180
    let a = 1
    let b = 0
    let c = 0
    let d = 1
    let dx = 0
    let dy = 0
    switch ((rotationDegrees + 360) % 360) {
      case 90:
        a = 0
        b = 1
        c = -1
        d = 0
        dx = h
        break
      case 180:
        a = -1
        d = -1
        dx = w
        dy = h
        break
      case 270:
        a = 0
        b = -1
        c = 1
        d = 0
        dy = w
        break
      default:
        break
    }
    return new DOMMatrix([a, b, c, d, dx, dy])
  }
  return null
}

const loadVideo = async (videoFile, orientation) => {
  const videoUrl = URL.createObjectURL(videoFile)
  const videoData = {
    file: videoFile,
    frames: [],
    config: null,
  }
  let xform = null
  const isRotated = (orientation / 90) % 2 == 1
  return getVideoFrames({
    videoUrl,
    async onFrame(frame) {
      // TODO Reuse canvases (clearing previously used)
      const canvas = document.createElement('canvas')
      const width = videoData.config.codedWidth
      const height = videoData.config.codedHeight

      const ctx = canvas.getContext('2d')
      if (xform) {
        const maxSize = Math.max(width, height)
        canvas.width = maxSize
        canvas.height = maxSize
        ctx.save()
        ctx.setTransform(xform)
        ctx.drawImage(frame, 0, 0, width, height)
        ctx.restore()
      } else {
        canvas.width = width
        canvas.height = height
        ctx.drawImage(frame, 0, 0, width, height)
      }
      const imageData = isRotated
        ? ctx.getImageData(0, 0, height, width)
        : ctx.getImageData(0, 0, width, height)

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
      const { codedWidth: w, codedHeight: h } = config
      if (orientation != 0) {
        xform = getRotationMatrix(orientation, w, h)
      }
    },
  }).then(() => {
    URL.revokeObjectURL(videoFile)
    return videoData
  })
}

const onFileChange = (e) => {
  const files = e.target.files
  if (files.length) {
    const videoFile = files[0]

    getFileSignature(videoFile)
      .then((signature) =>
        getMediaProperties(videoFile).then((mediaProperties) => ({
          fileSignature: signature,
          ...mediaProperties,
        })),
      )
      .then(async (fileData) => {
        const videoData = await loadVideo(videoFile, fileData.orientation)
        return {
          ...fileData,
          ...videoData,
        }
      })
      .then(async (videoData) => {
        try {
          const videoDescription = {
            fileName: videoData.file.name,
            sizeBytes: videoData.file.size,
            signature: videoData.fileSignature,
            frameCount: videoData.frameCount,
            frameRate: videoData.frameRate,
            orientationDegrees: videoData.orientation,
          }
          const saved = await sourceVideoRepository.saveVideo(videoDescription)
          console.log('save video data', videoData, saved)
        } catch (e) {
          console.error(e)
        }
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
                      :max="videoFrames.length"
                      label-always
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
@/util/fileUtil
