<script setup lang="ts">
import { ref } from 'vue'

import type { ImageContent } from '@/models/ImageContent'

import LoadVideo from '../components/LoadVideo.vue'
import BoundingBoxEditor from '../components/BoundingBoxEditor.vue'

const videoController = ref()

const videoFrameContent = ref<ImageContent | undefined>()

const onFrameChange = (e) => {
  // TODO Query selection and pose data against this frame before forwarding it. Set initial data then full data once queried.
  videoFrameContent.value = e
}

const onSeekFrame = ({ delta }) => {
  if (delta) {
    videoController.value.changeFrame(delta)
  }
}
</script>

<template lang="pug">
q-page.row
    LoadVideo.col-3.q-px-md(ref="videoController" column :isEventEmitter="true" @frameChange='onFrameChange')
    BoundingBoxEditor.col(:imageContent="videoFrameContent" @seekFrame="onSeekFrame")
</template>
