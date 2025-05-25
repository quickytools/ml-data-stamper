<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'

const editorCanvas = ref()
const editorCanvasWidth = ref(0)
const editorCanvasHeight = ref(0)
const controller = ref({ userDrawing: false, isItDraggable: false, isResizing: false }) // this is the controller object that will be used to control the annotation box
const whereUserClicked = { x: 0, y: 0 } // this is the object that will store the coordinates of the mouse click
const coordinate = { x: 0, y: 0 } //
const cursor = ref({
  sizingDirection: { left: false, right: false, top: false, bottom: false },
  hovering: false,
  crosshair: false,
})
let rectangle = {
  // annotation box
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  outterLayer: 15,
  contains: function (coordinate: { x: number; y: number }) {
    return (
      coordinate.x >= this.x &&
      coordinate.x <= this.x + this.width &&
      coordinate.y >= this.y &&
      coordinate.y <= this.y + this.height
    )
  },
  outterZoneDetects: function (coordinate: { x: number; y: number }) {
    return (
      coordinate.x >= this.x - this.outterLayer &&
      coordinate.x <= this.x + this.width + this.outterLayer &&
      coordinate.y >= this.y - this.outterLayer &&
      coordinate.y <= this.y + this.height + this.outterLayer
    )
  },
  updating: function (x: number, y: number, width: number, height: number) {
    this.x = x
    this.y = y
    this.width = width
    this.height = height
  },
  checkLeftZone: function (coordinate: { x: number }) {
    return coordinate.x >= this.x - this.outterLayer && coordinate.x <= this.x
  },
}

function drawCheckerboard(canvas, lightColor: string, darkColor: string) {
  const ctx = canvas.getContext('2d')
  const canvasWidth = canvas.width
  const canvasHeight = canvas.height
  // checkerboard pattern utilizes Odd and Even rows and columns to create a pattern
  for (let i = 0; i <= canvasHeight / 10; i++) {
    for (let j = 0; j <= canvasWidth / 10; j++) {
      if ((j + i) % 2 === 0) {
        ctx.fillStyle = lightColor
        ctx.fillRect(j * 10, i * 10, 10, 10)
      } else {
        ctx.fillStyle = darkColor
        ctx.fillRect(j * 10, i * 10, 10, 10)
      }
    }
  }
}

// controller function to draw the background of the canvas
const canvasBackground = () => {
  const canvas = editorCanvas.value
  const lightColor = 'rgba(255, 255, 255, 0.80)'
  const darkColor = 'rgba(0, 0, 0, 0.05)'

  drawCheckerboard(canvas, lightColor, darkColor)
}

// model function to draw the rectangle on the canvas
const drawOnCanvas = (x1: number, y1: number, x2: number, y2: number) => {
  const canvas = editorCanvas.value
  const ctx = canvas.getContext('2d')

  ctx.clearRect(0, 0, canvas.width, canvas.height) // these two lines of code help to clear the blurred lines, or having a trail effect
  canvasBackground() // this redraws the background
  cursor.value.crosshair = true // this is used to show the crosshair cursor when the user is drawing

  const startX = Math.min(x1, x2)
  const startY = Math.min(y1, y2)
  const width = Math.abs(x2 - x1) // subtracting coordinates gives the distance between two areas
  const height = Math.abs(y2 - y1)

  rectangle = {
    x: startX,
    y: startY,
    width: width,
    height: height,
    outterLayer: rectangle.outterLayer,
    contains: rectangle.contains,
    outterZoneDetects: rectangle.outterZoneDetects,
    checkLeftZone: rectangle.checkLeftZone,
  } // this is the rectangle object that will be to store the coordinates of the rectangle

  paintIt(startX, startY, width, height) // this function is used to draw the rectangle on the canvas
}

// model function to move the rectangle
const movingRectangle = (x: number, y: number) => {
  const Canvas = editorCanvas.value
  const ctx = Canvas.getContext('2d')

  ctx.clearRect(0, 0, Canvas.width, Canvas.height)
  canvasBackground() //redraws the background

  // updating the rectangle object with the new coordinates and size with the mouse click
  rectangle.x = x - whereUserClicked.x // this is used to move the rectangle with the mouse click
  rectangle.y = y - whereUserClicked.y // same as above
  rectangle.width = rectangle.width // width remains the same
  rectangle.height = rectangle.height // height remains the same
  rectangle = {
    x: x - whereUserClicked.x,
    y: y - whereUserClicked.y,
    width: rectangle.width,
    height: rectangle.height,
    outterLayer: rectangle.outterLayer,
    contains: rectangle.contains,
    outterZoneDetects: rectangle.outterZoneDetects,
    checkLeftZone: rectangle.checkLeftZone,
  }

  // drawing rectangle on the canvas
  paintIt(rectangle.x, rectangle.y, rectangle.width, rectangle.height)
}

// model function to resize the rectangle
const resizingRectangle = (x: number, y: number) => {
  const canvas = editorCanvas.value
  const ctx = canvas.getContext('2d')

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  canvasBackground()

  // Handle each side resizing
  if (cursor.value.sizingDirection.left) {
    const newWidth = rectangle.x + rectangle.width - x
    if (newWidth >= rectangle.outterLayer) {
      rectangle.x = x
      rectangle.width = newWidth
    }
  }
  if (cursor.value.sizingDirection.right) {
    const newWidth = x - rectangle.x
    if (newWidth >= rectangle.outterLayer) {
      rectangle.width = newWidth
    }
  }
  if (cursor.value.sizingDirection.top) {
    const newHeight = rectangle.y + rectangle.height - y
    if (newHeight >= rectangle.outterLayer) {
      rectangle.y = y
      rectangle.height = newHeight
    }
  }
  if (cursor.value.sizingDirection.bottom) {
    const newHeight = y - rectangle.y
    if (newHeight >= rectangle.outterLayer) {
      rectangle.height = newHeight
    }
  }

  // Draw the resized rectangle
  paintIt(rectangle.x, rectangle.y, rectangle.width, rectangle.height)
}

// view function for user to see the rectangle
const paintIt = (x: number, y: number, width: number, height: number) => {
  const canvas = editorCanvas.value
  const ctx = canvas.getContext('2d')
  ctx.beginPath()
  ctx.fillStyle = 'rgba(255, 0, 0, 0.05)'
  ctx.fillRect(x, y, width, height)
}

// helper function to get the mouse position on the canvas
function getMousePositionOnCanvas(action: MouseEvent) {
  const canvas = editorCanvas.value // get the canvas element
  const canvasSpace = canvas.getBoundingClientRect() // get the canvas position
  const scaleX = canvas.width / canvasSpace.width // get the scale of the canvas example: 1600/800 = 2 this mean it has double the pixel width
  const scaleY = canvas.height / canvasSpace.height // same as scaleX but for the height
  return {
    x: (action.clientX - canvasSpace.left) * scaleX, // get the x coordinate of the mouse click
    y: (action.clientY - canvasSpace.top) * scaleY, // get the y coordinate of the mouse click
  }
}

// controller function to check if the user is clicking on the canvas
const mouseDownOnCanvas = (action: MouseEvent) => {
  const noController = controller.value
  const { x, y } = getMousePositionOnCanvas(action) // get the mouse position on the canvas
  coordinate.x = x // set the x coordinate of the mouse click
  coordinate.y = y // same as above

  if (rectangle.contains(coordinate)) {
    // check if the mouse click is inside the rectangle

    whereUserClicked.x = coordinate.x - rectangle.x // get the x coordinate of the mouse click to be used to move the rectangle regardless of the mouse position in the rectangle
    whereUserClicked.y = coordinate.y - rectangle.y // same as above

    controller.value = {
      ...noController,
      isItDraggable: true, // set the flag to true if the user is dragging the rectangle
    }
  }
  // check if the mouse click is on the outter layer of the rectangle
  else if (rectangle.outterZoneDetects(coordinate)) {
    // check if the mouse click is on the left side of the rectangle changes to true if the mouse click is on the left side of the rectangle
    cursor.value.sizingDirection.left = rectangle.checkLeftZone(coordinate)
    // check if the mouse click is on the right side of the rectangle changes to true if the mouse click is on the right side of the rectangle
    cursor.value.sizingDirection.right =
      coordinate.x >= rectangle.x + rectangle.width &&
      coordinate.x <= rectangle.x + rectangle.width + rectangle.outterLayer
    // check if the mouse click is on the top side of the rectangle changes to true if the mouse click is on the top side of the rectangle
    cursor.value.sizingDirection.top =
      coordinate.y >= rectangle.y - rectangle.outterLayer && coordinate.y <= rectangle.y
    // check if the mouse click is on the bottom side of the rectangle changes to true if the mouse click is on the bottom side of the rectangle
    cursor.value.sizingDirection.bottom =
      coordinate.y >= rectangle.y + rectangle.height &&
      coordinate.y <= rectangle.y + rectangle.height + rectangle.outterLayer

    controller.value = {
      ...noController,
      isResizing: true, // set the flag to true if the user is resizing the rectangle
    }
  } else {
    controller.value = {
      ...noController,
      userDrawing: true, // set the flag to true if the user is drawing
    }
  }
}

const mouseUpOnCanvas = () => {
  // controller function to check if the user releases the mouse button on the canvas
  // changes the flags to false
  controller.value = {
    userDrawing: false,
    isItDraggable: false,
    isResizing: false,
  }
  // reset the rectangle object
  cursor.value.sizingDirection = {
    left: false,
    right: false,
    top: false,
    bottom: false,
  }
}

const mouseMoveOnCanvas = (action: MouseEvent) => {
  // controller function to check if the user is moving the mouse on the canvas
  const { x, y } = getMousePositionOnCanvas(action) // get the mouse position on the canvas
  const temp = { x: x, y: y } // store the mouse position in a temporary variable

  if (
    !controller.value.isItDraggable &&
    !controller.value.isResizing &&
    !controller.value.userDrawing
  ) {
    // check if the user is not dragging or resizing the rectangle
    cursor.value.hovering = rectangle.contains(temp)
  }

  if (controller.value.isItDraggable) {
    // check if the user is dragging the rectangle
    movingRectangle(x, y)
  } else if (controller.value.isResizing) {
    // check if the user is resizing the rectangle
    resizingRectangle(x, y)
  } else if (controller.value.userDrawing) {
    // check if the user is drawing
    drawOnCanvas(coordinate.x, coordinate.y, x, y)
  }
}

onMounted(() => {
  const canvasWidth = 600
  const canvasHeight = 400
  editorCanvasWidth.value = canvasWidth
  editorCanvasHeight.value = canvasHeight

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
        :class="{canvas: cursor.crosshair, hover: cursor.hovering, dragging: controller.isItDraggable,'resize-left': cursor.sizingDirection.left, 'resize-right': cursor.sizingDirection.right, 'resize-top': cursor.sizingDirection.top, 'resize-bottom': cursor.sizingDirection.bottom, 'top-left-corner': cursor.sizingDirection.left && cursor.sizingDirection.top, 'top-right-corner': cursor.sizingDirection.right && cursor.sizingDirection.top, 'bottom-left-corner': cursor.sizingDirection.left && cursor.sizingDirection.bottom, 'bottom-right-corner': cursor.sizingDirection.right && cursor.sizingDirection.bottom}"
        @mousedown="mouseDownOnCanvas"
        @mousemove="mouseMoveOnCanvas"
        @mouseup="mouseUpOnCanvas"
    )
    p
</template>

<style scoped>
canvas {
  cursor: crosshair;
}
.hover {
  cursor: grab;
}
.dragging {
  cursor: grabbing;
}
.resize-left {
  cursor: w-resize;
}
.resize-right {
  cursor: e-resize;
}
.resize-top {
  cursor: n-resize;
}
.resize-bottom {
  cursor: s-resize;
}
.top-left-corner {
  cursor: nw-resize;
}
.top-right-corner {
  cursor: ne-resize;
}
.bottom-left-corner {
  cursor: sw-resize;
}
.bottom-right-corner {
  cursor: se-resize;
}
</style>
