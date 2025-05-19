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
const rectangle = ref({x: 0, y: 0, width: 0, height: 0, outterLayer: 10});// this is the rectangle object that will be to store the coordinates of the rectangle and rectangle size
const whereUserClicked = ref({x: 0, y:0});// this is the object that will store the coordinates of the mouse click
const whereUserReleased = ref({x: 0, y:0});// this is the object that will store the coordinates of the mouse release
const isResizing = ref(false); // this is a flag to check if the user is resizing the rectangle
const sizingDirection = ref({left: false, right: false, top: false, bottom: false}); // used to check if the user is resizing the rectangle

const canvasBackground = () => {// this function is used to draw the background of the canvas
  const canvas = editorCanvas.value;
  const ctx = canvas.getContext('2d');
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  // checkerboard pattern utilizes Odd and Even rows and columns to create a pattern
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

const drawOnCanvas = (x1: number, y1: number, x2: number, y2: number) => {// controller function to draw the rectangle on the canvas
  const canvas = editorCanvas.value;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height); // these two lines of code help to clear the blurred lines, or having a trail effect
  canvasBackground();// this redraws the background

  const startX = Math.min(x1, x2);
  const startY = Math.min(y1, y2);
  const width = Math.abs(x2 - x1); // subtracting coordinates gives the distance between two areas
  const height = Math.abs(y2 - y1);

  rectangle.value = {
      x: startX,
      y: startY,
      width: width,
      height: height,
      outterLayer: rectangle.value.outterLayer
    } // this is the rectangle object that will be to store the coordinates of the rectangle

  paintIt(startX, startY, width, height) // this function is used to draw the rectangle on the canvas
}

const movingRectangle = (x: number, y: number) => {// this function is called when the user drags the rectangle
  const Canvas = editorCanvas.value
  const ctx = Canvas.getContext('2d')

  ctx.clearRect(0, 0, Canvas.width, Canvas.height);
  canvasBackground();//redraws the background

  rectangle.value = {// updating the rectangle object with the new coordinates with the mouse click
    x: x - whereUserClicked.value.x, // sets the new value of the rectangle object minus the x coordinate of the mouse click
    y: y - whereUserClicked.value.y, // sets the new value of the rectangle object minus the y coordinate of the mouse click
    width: rectangle.value.width,
    height: rectangle.value.height,
    outterLayer: rectangle.value.outterLayer
  };

  // drawing rectangle on the canvas
  paintIt(rectangle.value.x, rectangle.value.y, rectangle.value.width, rectangle.value.height)
}

const resizingRectangle = (x: number, y: number) => {// model function to resize the rectangle
  const canvas = editorCanvas.value
  const ctx = canvas.getContext('2d')

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  canvasBackground()

  // Handle each side resizing
  if (sizingDirection.value.left) {
    const newWidth = rectangle.value.x + rectangle.value.width - x
    if (newWidth >= rectangle.value.outterLayer) {
      rectangle.value.x = x
      rectangle.value.width = newWidth
    }
  }
  if (sizingDirection.value.right) {
    const newWidth = x - rectangle.value.x
    if (newWidth >= rectangle.value.outterLayer) {
      rectangle.value.width = newWidth
    }
  }
  if (sizingDirection.value.top) {
    const newHeight = rectangle.value.y + rectangle.value.height - y
    if (newHeight >= rectangle.value.outterLayer) {
      rectangle.value.y = y
      rectangle.value.height = newHeight
    }
  }
  if (sizingDirection.value.bottom) {
    const newHeight = y - rectangle.value.y
    if (newHeight >= rectangle.value.outterLayer) {
      rectangle.value.height = newHeight
    }
  }

  // Draw the resized rectangle
  paintIt(rectangle.value.x, rectangle.value.y, rectangle.value.width, rectangle.value.height)
}

const paintIt = (x: number, y: number, width: number, height: number) => {// view function for user to see the rectangle
  const canvas = editorCanvas.value
  const ctx = canvas.getContext('2d')
  ctx.beginPath()
  ctx.fillStyle = 'rgba(255, 0, 0, 0.05)'
  ctx.fillRect(x, y, width, height)
}

const mouseDownOnCanvas = (action: MouseEvent) =>{// controller function to check if the user is clicking on the canvas
  const {x, y} = getMousePositionOnCanvas(action); // get the mouse position on the canvas
  x1Coordinate.value = x; // set the x coordinate of the mouse click
  y1Coordinate.value = y; // same as above

  // resets the flags to false
  sizingDirection.value = {
    left: false,
    right: false,
    top: false,
    bottom: false
  }

  if(x1Coordinate.value >= rectangle.value.x && x1Coordinate.value <= rectangle.value.x + rectangle.value.width
      && y1Coordinate.value >= rectangle.value.y && y1Coordinate.value <= rectangle.value.y + rectangle.value.height){// check if the mouse click is inside the rectangle

    whereUserClicked.value.x = x1Coordinate.value - rectangle.value.x; // get the x coordinate of the mouse click to be used to move the rectangle regardless of the mouse position in the rectangle
    whereUserClicked.value.y = y1Coordinate.value - rectangle.value.y; // same as above

    userDrawing.value = false;
    isItDraggable.value = true; // set the flag to true once the user in the rectangle
    isResizing.value = false;
  }
  else if(x1Coordinate.value >= rectangle.value.x - rectangle.value.outterLayer && x1Coordinate.value <= rectangle.value.x + rectangle.value.width + rectangle.value.outterLayer
       && y1Coordinate.value >= rectangle.value.y - rectangle.value.outterLayer && y1Coordinate.value <= rectangle.value.y + rectangle.value.height + rectangle.value.outterLayer){// check if the mouse click is on the outter layer of the rectangle

    // check if the mouse click is on the left side of the rectangle changes to true if the mouse click is on the left side of the rectangle
    sizingDirection.value.left = x1Coordinate.value >= rectangle.value.x - rectangle.value.outterLayer && x1Coordinate.value  <= rectangle.value.x;
    // check if the mouse click is on the right side of the rectangle changes to true if the mouse click is on the right side of the rectangle
    sizingDirection.value.right = x1Coordinate.value >= rectangle.value.x + rectangle.value.width && x1Coordinate.value  <= rectangle.value.x + rectangle.value.width + rectangle.value.outterLayer;
    // check if the mouse click is on the top side of the rectangle changes to true if the mouse click is on the top side of the rectangle
    sizingDirection.value.top = y1Coordinate.value >= rectangle.value.y - rectangle.value.outterLayer && y1Coordinate.value  <= rectangle.value.y;
    // check if the mouse click is on the bottom side of the rectangle changes to true if the mouse click is on the bottom side of the rectangle
    sizingDirection.value.bottom = y1Coordinate.value >= rectangle.value.y + rectangle.value.height && y1Coordinate.value  <= rectangle.value.y + rectangle.value.height + rectangle.value.outterLayer;

    userDrawing.value = false;
    isItDraggable.value = false;
    isResizing.value = true; // set the flag to true if the user is resizing the rectangle
  }
  else{
    userDrawing.value = true; // set the flag to true if the user is drawing
    isItDraggable.value = false;
    isResizing.value = false;
  }
}

const mouseUpOnCanvas = () => {// controller function to check if the user releases the mouse button on the canvas
  userDrawing.value = false;
  isItDraggable.value = false; // set the flag to false once the user releases the mouse button
  isResizing.value = false;
  whereUserReleased.value = {
    x: x1Coordinate.value,
    y: y1Coordinate.value
  }
}

const mouseMoveOnCanvas = (action: MouseEvent) => {// controller function to check if the user is moving the mouse on the canvas
  const {x , y} = getMousePositionOnCanvas(action); // get the mouse position on the canvas
  if(isItDraggable.value){
    movingRectangle(x, y);
  }
  else if(isResizing.value){
    resizingRectangle(x, y);
  }
  else if(userDrawing.value){ // if the user is not drawing, do nothing
    drawOnCanvas(x1Coordinate.value, y1Coordinate.value, action.offsetX, action.offsetY)
  }
}

function getMousePositionOnCanvas(action: MouseEvent){// helper function to get the mouse position on the canvas
  const canvas = editorCanvas.value; // get the canvas element
  const canvasSpace = canvas.getBoundingClientRect(); // get the canvas position
  const scaleX = canvas.width / canvasSpace.width; // get the scale of the canvas example: 1600/800 = 2 this mean it has double the pixel width
  const scaleY = canvas.height / canvasSpace.height; // same as scaleX but for the height
  return {
    x: (action.clientX - canvasSpace.left) * scaleX, // get the x coordinate of the mouse click
    y: (action.clientY - canvasSpace.top) * scaleY // get the y coordinate of the mouse click
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
