<script setup lang="ts">
import LoadVideo from '../components/LoadVideo.vue'

</script>

<template lang="pug">
  LoadVideo(:isEventEmitter="false" @frameChange='onFrameChange')
</template>
