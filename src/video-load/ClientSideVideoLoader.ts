import type { VideoLoader } from './VideoLoader'
import { getFileSignature } from '@/util/fileUtil'

// TODO Use local module
import getVideoFrames from 'https://deno.land/x/get_video_frames@v0.0.10/mod.js'

type VideoFileProperties = {
  duration: number
  frameRate: number
  frameCount: number
  orientation: number
}

export class ClientSideVideoLoader extends EventTarget implements VideoLoader {
  private async getMediaProperties(file: File): Promise<VideoFileProperties> {
    const readChunk = async (chunkSize: number, offset: number) =>
      new Uint8Array(await file.slice(offset, offset + chunkSize).arrayBuffer())

    // TODO Package library rather than loading from CDN
    //      Will throw errors due to WASM loading so use CDN until ready
    //      Can also defer loading until necessary
    const mediaInfo = await MediaInfo.mediaInfoFactory()
    try {
      const info = await mediaInfo.analyzeData(file.size, readChunk)
      const tracks = info.media.track
      const filterTrackType = (typeValue: string) => {
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
      mediaInfo.close()

      let orientation = 0
      try {
        orientation = (parseInt(rotationText ?? '0') + 360) % 360
      } catch {}

      return { duration: duration, frameRate: frameRate, frameCount: frameCount, orientation }
    } finally {
      mediaInfo.close()
    }
  }

  private getRotationMatrix(rotationDegrees: number, w: number, h: number): DOMMatrix | null {
    if (rotationDegrees != 0) {
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

  private async loadVideo(videoFile: File, orientation: number) {
    const videoUrl = URL.createObjectURL(videoFile)
    const videoData = { file: videoFile, frames: [] }
    let xform: DOMMatrix | null = null
    const isRotated = (orientation / 90) % 2 == 1
    let videoConfig: any = null

    const getRotationMatrix = this.getRotationMatrix

    await getVideoFrames({
      videoUrl,
      async onFrame(frame) {
        // TODO Reuse canvases (clearing previously used)
        const canvas = document.createElement('canvas')
        const { codedWidth: width, codedHeight: height } = videoConfig

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

        const { duration, timestamp } = frame
        videoData.frames.push({ content: imageData, timestamp, duration })
        frame.close()
      },
      onConfig(config) {
        videoConfig = config
        const { codedWidth: w, codedHeight: h } = config
        if (orientation != 0) {
          xform = getRotationMatrix(orientation, w, h)
          videoData.width = config.codedHeight
          videoData.height = config.codedWidth
        } else {
          videoData.width = config.codedWidth
          videoData.height = config.codedHeight
        }
      },
    })

    URL.revokeObjectURL(videoFile)

    return videoData
  }

  async load(file: File): Promise<any> {
    const signature = await getFileSignature(file)

    const mediaProperties = await this.getMediaProperties(file)

    const fileData = {
      fileSignature: signature,
      ...mediaProperties,
    }
    const videoData = await this.loadVideo(file, fileData.orientation)

    return { ...fileData, ...videoData }
  }
}
