<script setup lang="ts">
import { x } from 'joi'
import { ref, onMounted, nextTick } from 'vue'

const editorCanvas = ref()
const editorCanvasWidth = ref(0)
const editorCanvasHeight = ref(0)
const x1Coordinate = ref(0); // this is the x coordinate of the mouse click
const y1Coordinate = ref(0); // this is the y coordinate of the mouse click
const userDrawing = ref(false);
const isItDraggable = ref(false); // this is a flag to check if the user is dragging the rectangle
const rectangle = ref({x: 0, y: 0, width: 0, height: 0, outterLayer: 20});// this is the rectangle object that will be to store the coordinates of the rectangle and rectangle size
const whereUserClicked = ref({x: 0, y:0});// this is the object that will store the coordinates of the mouse click
const whereUserReleased = ref({x: 0, y:0});// this is the object that will store the coordinates of the mouse release
const isResizing = ref(false); // this is a flag to check if the user is resizing the rectangle
const sizingDirection = ref({left: false, right: false, top: false, bottom: false}); // used to check if the user is resizing the rectangle
const EDGE


const canvasBackground = () => {
  const canvas = editorCanvas.value;
  const ctx = canvas.getContext('2d');
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
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
  rectangle.value = {
     x: startX,
     y: startY,
     width: width,
     height: height,
     outterLayer: rectangle.value.outterLayer} // this is the rectangle object that will be to store the coordinates of the rectangle
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
    height: rectangle.value.height,
    outterLayer: rectangle.value.outterLayer
  };

  ctx.beginPath();
  ctx.fillStyle = 'rgba(255, 0, 0, 0.05)';
  ctx.fillRect(rectangle.value.x, rectangle.value.y, rectangle.value.width, rectangle.value.height); // draw the rectangle
}

const resizingRectangle = (action: MouseEvent) => {
  const canvas = editorCanvas.value
  const ctx = canvas.getContext('2d')

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  canvasBackground()

  // Handle each side resizing
  if (sizingDirection.value.left) {
    const newWidth = rectangle.value.x + rectangle.value.width - action.offsetX
    if (newWidth >= rectangle.value.outterLayer) {
      rectangle.value.x = action.offsetX
      rectangle.value.width = newWidth
    }
  }
  else if (sizingDirection.value.right) {
    const newWidth = action.offsetX - rectangle.value.x
    if (newWidth >= rectangle.value.outterLayer) {
      rectangle.value.width = newWidth
    }
  }
  else if (sizingDirection.value.top) {
    const newHeight = rectangle.value.y + rectangle.value.height - action.offsetY
    if (newHeight >= rectangle.value.outterLayer) {
      rectangle.value.y = action.offsetY
      rectangle.value.height = newHeight
    }
  }
  else if (sizingDirection.value.bottom) {
    const newHeight = action.offsetY - rectangle.value.y
    if (newHeight >= rectangle.value.outterLayer) {
      rectangle.value.height = newHeight
    }
  }

  // Draw the resized rectangle
  ctx.beginPath()
  ctx.fillStyle = 'rgba(255, 0, 0, 0.05)'
  ctx.fillRect(
    rectangle.value.x,
    rectangle.value.y,
    rectangle.value.width,
    rectangle.value.height
  )
}

const mouseDownOnCanvas = (action: MouseEvent) =>{
  const canvas = editorCanvas.value;
  const rect = canvas.getBoundingClientRect();
  x1Coordinate.value = action.clientX - canvas.left; // x coordinate of the mouse click
  y1Coordinate.value = action.clientY - canvas.top; // y coordinate of mouse click
 // isResizing.value = true; // set the flag to true once the user clicks on the outter layer of the rectangle

  if(x1Coordinate.value >= rectangle.value.x && x1Coordinate.value <= rectangle.value.x + rectangle.value.width
      && y1Coordinate.value >= rectangle.value.y && y1Coordinate.value <= rectangle.value.y + rectangle.value.height){// check if the mouse click is inside the rectangle

    whereUserClicked.value.x = x1Coordinate.value - rectangle.value.x; // get the x & y coordinate of the mouse click
    whereUserClicked.value.y = y1Coordinate.value - rectangle.value.y;

    isResizing.value = false; // set the flag to false once the user clicks on the rectangle
    userDrawing.value = false; // set the flag to false once mouse is on the rectangle
    isItDraggable.value = true; // set the flag to true once the user on the rectangle
  }
  else if(x1Coordinate.value >= rectangle.value.x - rectangle.value.outterLayer && x1Coordinate.value <= rectangle.value.x + rectangle.value.width + rectangle.value.outterLayer
      && y1Coordinate.value >= rectangle.value.y - rectangle.value.outterLayer && y1Coordinate.value <= rectangle.value.y + rectangle.value.height + rectangle.value.outterLayer){// check if the mouse click is on the outter layer of the rectangle
    if(x1Coordinate.value >= rectangle.value.x - rectangle.value.outterLayer && x1Coordinate.value  <= rectangle.value.x){
      sizingDirection.value.left = true; // set the flag to true once the user clicks on the left side of the rectangle
    }
    else if(x1Coordinate.value  >= rectangle.value.x + rectangle.value.width && x1Coordinate.value  <= rectangle.value.x + rectangle.value.width + rectangle.value.outterLayer){
      sizingDirection.value.right = true; // set the flag to true once the user clicks on the right side of the rectangle
    }
    else if(y1Coordinate.value  >= rectangle.value.y - rectangle.value.outterLayer && y1Coordinate.value  <= rectangle.value.y){
      sizingDirection.value.top = true; // set the flag to true once the user clicks on the top side of the rectangle
    }
    else if(y1Coordinate.value  >= rectangle.value.y + rectangle.value.height && y1Coordinate.value  <= rectangle.value.y + rectangle.value.height + rectangle.value.outterLayer){
      sizingDirection.value.bottom = true; // set the flag to true once the user clicks on the bottom side of the rectangle
    }
    userDrawing.value = false;
    isItDraggable.value = false;
    isResizing.value = true; // set the flag to true once the user clicks on the outter layer of the rectangle
  }
  else{
    isResizing.value = false; // set the flag to false if away from the rectangles perimeter
    isItDraggable.value = false; // set the flag to false when user clicks on the canvas
    userDrawing.value = true; // set the flag to true when the user clicks on the canvas
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
  else if(isResizing.value){
    resizingRectangle(action);
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



