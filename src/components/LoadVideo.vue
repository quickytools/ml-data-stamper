<script setup lang="ts">
// const fileInput = document.getElementById('file')
//   fileInput.addEventListener('change', (e) => {
//     const files = e.target.files
//     if (files.length) {
//       console.log('file is loaded', files.length, files[0])
//     }
//   })
</script>

<template lang="pug">
form
  label(for="file") File
  input#file(type="file")
</template>
