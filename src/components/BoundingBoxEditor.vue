<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'

const editorCanvas = ref()
const editorCanvasWidth = ref(0)
const editorCanvasHeight = ref(0)
const x1Coordinate = ref(0)
const y1Coordinate = ref(0)
const userDrawing = ref(false)

const canvasBackground = () => {
  const canvas = editorCanvas.value
  const ctx = canvas.getContext('2d')
  const canvasWidth = canvas.width
  const canvasHeight = canvas.height
  // checkerboard pattern utilizes Odd and Even rows and columns to create a pattern
  // for each row, if the sum of the row and column index is even, draw a stroke
  // otherwise, fill the rectangle with a different color
  for(let i = 0; i <= canvasHeight / 10; i++){
    for(let j = 0; j <= canvasWidth / 10; j++){
      if((j + i) % 2 === 0){
        ctx.fillStyle = 'rgba(255, 255, 255, 0.80)';
        ctx.fillRect(j * 10, i * 10, 10, 10);
      }
      else{
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; // the very last value changes the transparency of the darker boxes.
        ctx.fillRect(j * 10, i * 10, 10, 10);
      }
    }
  }
}

const drawOnCanvas = (x1: number, y1: number, x2: number, y2: number) => {
  const canvas = editorCanvas.value;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height); // these two lines of code help to clear the blurred lines, or having a trail effect
 canvasBackground();// this redraws the background

  const startX = Math.min(x1, x2);
  const startY = Math.min(y1, y2);
  const width = Math.abs(x2 - x1); // subtracting coordinates gives the distance between two areas
  const height = Math.abs(y2 - y1);

  ctx. beginPath();
  ctx.fillStyle = 'rgba(255, 0, 0, 0.03)';
  ctx.fillRect(startX, startY, width, height); // draw the rectangle

  /* ctx.fillStyle = 'orange'
  ctx.beginPath()
  const radius = (canvasWidth + canvasHeight) * 0.1
  ctx.ellipse(canvasWidth * 0.5, canvasHeight * 0.5, radius, radius, 50, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'green'
  ctx.fillRect(50, 150, 60, 20) */
}

const mouseDownOnCanvas = (action: MouseEvent) =>{
  userDrawing.value = true; // set the flag to true once the user clicks on the canvas
  x1Coordinate.value = action.offsetX; // get the x coordinate of the mouse click
  y1Coordinate.value = action.offsetY;
}

const mouseUpOnCanvas = () => {
  userDrawing.value = false;
}

const mouseMoveOnCanvas = (action: MouseEvent) => {
  if(!userDrawing.value) return; // if the user is not drawing, do nothing
  drawOnCanvas(x1Coordinate.value, y1Coordinate.value, action.offsetX, action.offsetY)
}

onMounted(() => {
  const canvasWidth = 600;
  const canvasHeight = 400;
  editorCanvasWidth.value = canvasWidth
  editorCanvasHeight.value = canvasHeight;

  // Wait for next animation frame before drawing on canvas or draw calls are dropped
  window.requestAnimationFrame(canvasBackground)
})
</script>

<template lang="pug">
div.column
    p Bounding box editor
    canvas(
        ref="editorCanvas"
        :width='editorCanvasWidth'
        :height='editorCanvasHeight'
        @mousedown="mouseDownOnCanvas"
        @mousemove="mouseMoveOnCanvas"
        @mouseup="mouseUpOnCanvas"
    )

</template>

<style scoped>
  canvas {
    cursor:crosshair;
  }
</style>

