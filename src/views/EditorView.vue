<script setup lang="ts">
import { ref } from 'vue'

import type { ImageContent } from '@/models/ImageContent'

import LoadVideo from '../components/LoadVideo.vue'
import BoundingBoxEditor from '../components/BoundingBoxEditor.vue'

const videoController = ref()

const videoFrameContent = ref<ImageContent | undefined>()

const onFrameChange = (e) => {
  videoFrameContent.value = e
}

const onScrubFrame = (delta) => {
  videoController.value.changeFrame(delta)
}
</script>

<template lang="pug">
q-page.row
    LoadVideo.col-3.q-px-md(ref="videoController" column :isEventEmitter="true" @frameChange='onFrameChange')
    BoundingBoxEditor.col(:imageContent="videoFrameContent")
</template>
