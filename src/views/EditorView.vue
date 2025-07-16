<script setup lang="ts">
import { ref, inject } from 'vue'

import type { ImageContent } from '@/models/ImageContent'

import LoadVideo from '../components/LoadVideo.vue'
import BoundingBoxEditor from '../components/BoundingBoxEditor.vue'

const sourceVideoRepository = inject('source-video-repository')

const videoController = ref()

const videoFrameContent = ref<ImageContent | undefined>()

const onVideoLoad = async (videoDescription) => {
  const videoId = await sourceVideoRepository.saveVideo(videoDescription)
}

const onFrameChange = async (videoData) => {
  const { id: fileSignature } = videoData.identifier
  const videoDescription = await sourceVideoRepository.getVideo(fileSignature)
  if (videoDescription) {
    console.log('on frame change', videoData, videoDescription)
    // TODO Query selection and pose data against this frame before forwarding it. Set initial data then full data once queried.
    videoFrameContent.value = videoData
  } else {
    // TODO Timeout or observe query of video by file signature
  }
}

const onSeekFrame = ({ delta }) => {
  if (delta) {
    videoController.value.changeFrame(delta)
  }
}
</script>

<template lang="pug">
q-page.row
    LoadVideo.col-3.q-px-md(ref="videoController"
                            column
                            :isEventEmitter="true"
                            @videoLoad="onVideoLoad"
                            @frameChange='onFrameChange'
                            )
    BoundingBoxEditor.col(:imageContent="videoFrameContent" @seekFrame="onSeekFrame")
</template>
