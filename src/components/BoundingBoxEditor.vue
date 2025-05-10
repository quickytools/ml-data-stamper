<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'

const editorCanvas = ref()
const editorCanvasWidth = ref(0)
const editorCanvasHeight = ref(0)

const drawOnCanvas = () => {
  const canvas = editorCanvas.value
  const ctx = canvas.getContext('2d')
  const canvasWidth = canvas.width
  const canvasHeight = canvas.height

  // checkerboard pattern utilizes Odd and Even rows and columns to create a pattern
  // for each row, if the sum of the row and column index is even, draw a stroke
  // otherwise, fill the rectangle with a different color
  for(let i = 0; i <= canvasHeight; i++){
    for(let j = 0; j <= canvasWidth; j++){
      if((j + i) % 2 === 0){
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.20)';
        ctx.strokeRect(j * 10, i * 10, 10, 10);
      }
      else{
        ctx.fillStyle = 'rgba(5, 5, 5, 0.10)';
        ctx.fillRect(j * 10, i * 10, 10, 10);
      }
    }
  }
  /* ctx.strokeStyle = 'red'
  ctx.lineWidth = 64
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(canvasWidth, canvasHeight)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, canvasHeight)
  ctx.lineTo(canvasWidth, 0)
  ctx.stroke()

  ctx.fillStyle = 'orange'
  ctx.beginPath()
  const radius = (canvasWidth + canvasHeight) * 0.1
  ctx.ellipse(canvasWidth * 0.5, canvasHeight * 0.5, radius, radius, 50, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'green'
  ctx.fillRect(50, 150, 60, 20) */
}

onMounted(() => {
  const canvasWidth = 600;
  const canvasHeight = 400;
  editorCanvasWidth.value = canvasWidth
  editorCanvasHeight.value = canvasHeight

  // Wait for next animation frame before drawing on canvas or draw calls are dropped
  window.requestAnimationFrame(drawOnCanvas)
})
</script>

<template lang="pug">
div.column
    p Bounding box editor
    canvas(
        ref="editorCanvas"
        :width='editorCanvasWidth'
        :height='editorCanvasHeight',
    )
</template>

<style scoped></style>
