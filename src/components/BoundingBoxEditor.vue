<script setup lang="ts">
import { x } from 'joi'
import { ref, onMounted, nextTick } from 'vue'

const editorCanvas = ref()
const editorCanvasWidth = ref(0)
const editorCanvasHeight = ref(0)
const x1Coordinate = ref(0)
const y1Coordinate = ref(0)
const userDrawing = ref(false)
const isItDraggable = ref(false) // this is a flag to check if the user is dragging the rectangle
const rectangle = ref({x: 0, y: 0, width: 0, height: 0})// this is the rectangle object that will be to store the coordinates of the rectangle
const whereUserClicked = ref({x: 0, y:0})// this is the object that will store the coordinates of the mouse click
const whereUserReleased = ref({x: 0, y:0})// this is the object that will store the coordinates of the mouse release

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
  ctx.fillStyle = 'rgba(255, 0, 0, 0.05)';
  rectangle.value = {x: startX, y: startY, width: width, height: height} // this is the rectangle object that will be to store the coordinates of the rectangle
  ctx.fillRect(startX, startY, width, height); // draw the rectangle
}

const movingRectangle = (action: MouseEvent) => {// this function is called when the user drags the rectangle
  const Canvas = editorCanvas.value
  const ctx = Canvas.getContext('2d')

  ctx.clearRect(0, 0, Canvas.width, Canvas.height);
  canvasBackground();//redraws the background

  rectangle.value = {// updating the rectangle object with the new coordinates with the mouse click
    x: action.offsetX - whereUserClicked.value.x, // sets the new value of the rectangle object minus the x coordinate of the mouse click
    y: action.offsetY - whereUserClicked.value.y, // sets the new value of the rectangle object minus the y coordinate of the mouse click
    width: rectangle.value.width,
    height: rectangle.value.height
  };

  ctx.beginPath();
  ctx.fillStyle = 'rgba(255, 0, 0, 0.05)';
  ctx.fillRect(rectangle.value.x, rectangle.value.y, rectangle.value.width, rectangle.value.height); // draw the rectangle
}

const mouseDownOnCanvas = (action: MouseEvent) =>{
  x1Coordinate.value = action.offsetX; // get the x coordinate of the mouse click
  y1Coordinate.value = action.offsetY;
  if(x1Coordinate.value >= rectangle.value.x && x1Coordinate.value <= rectangle.value.x + rectangle.value.width
      && y1Coordinate.value >= rectangle.value.y && y1Coordinate.value <= rectangle.value.y + rectangle.value.height){

    whereUserClicked.value.x = x1Coordinate.value - rectangle.value.x; // get the x & y coordinate of the mouse click
    whereUserClicked.value.y = y1Coordinate.value - rectangle.value.y;

    userDrawing.value = false; // set the flag to false once mouse is on the rectangle
    isItDraggable.value = true; // set the flag to true once the user on the rectangle
  }
  else{
    userDrawing.value = true; // set the flag to true when the user clicks on the canvas
    isItDraggable.value = false; // set the flag to false when user clicks on the canvas
  }
}

const mouseUpOnCanvas = () => {
  userDrawing.value = false;
  isItDraggable.value = false; // set the flag to false once the user releases the mouse button
  whereUserReleased.value = {
    x: x1Coordinate.value,
    y: y1Coordinate.value
  }


}

const mouseMoveOnCanvas = (action: MouseEvent) => {
  if(isItDraggable.value){
    movingRectangle(action);
  }
  else if(userDrawing.value){ // if the user is not drawing, do nothing
  drawOnCanvas(x1Coordinate.value, y1Coordinate.value, action.offsetX, action.offsetY)
  }
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
    p Click and drag to draw a bounding box. user clicked on x: {{whereUserReleased.x}}, y: {{whereUserReleased.y}}. Click and drag to move the rectangle.
</template>

<style scoped>
  canvas {
    cursor:crosshair;
  }
</style>

