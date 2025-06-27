<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <q-layout class="fullscreen layout-width" view="hHh lpR fFf">
    <q-page-container>
      <RouterView />
    </q-page-container>
  </q-layout>
</template>

<style scoped>
.layout-width {
  max-width: 1280px;
  margin: auto;
}
</style>
