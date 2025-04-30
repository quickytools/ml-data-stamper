<script setup lang="ts"></script>

<template lang="pug">
  main#main
    div.column
      router-link(to="/bounding-box-editor") Bounding box editor
      router-link(to="/load-video") Load video
</template>

<style scoped>
#main {
  min-width: 600px;
}
</style>
