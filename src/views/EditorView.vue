<script setup lang="ts">
import { ref } from 'vue'

import LoadVideo from '../components/LoadVideo.vue'
import BoundingBoxEditor from '../components/BoundingBoxEditor.vue'

const videoController = ref()

const currentFrameData = ref<{
  content: ImageData
  width: number
  height: number
} | null>(null)

const onFrameChange = (e) => {
  // TODO Send to box editor
  currentFrameData.value = e
}

const onScrubFrame = (delta) => {
  videoController.value.changeFrame(delta)
}
</script>

<template lang="pug">
q-page.row
    LoadVideo.col-3.q-px-md(ref="videoController" column :isEventEmitter="true" @frameChange='onFrameChange')
    BoundingBoxEditor.col
</template>
