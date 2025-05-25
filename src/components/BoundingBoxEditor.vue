<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'

const editorCanvas = ref()
const editorCanvasWidth = ref(0)
const editorCanvasHeight = ref(0)
const controller = ref({ isDrawing: false, isDraggable: false, isResizing: false }) // this is the controller object that will be used to control the annotation box
const coordinate = { x: 0, y: 0 } // this is the coordinate object that will be used to store the mouse position on the canvas
const cursor = ref({
  sizingDirection: { left: false, right: false, top: false, bottom: false },
  hovering: false,
  crosshair: false,
})
const rectangle = {
  // annotation box
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  outterLayer: 15,
  whereUserClicked: { x: 0, y: 0 },
  storeUserClick: function (coordinate: { x: number; y: number }) {
    this.whereUserClicked.x = coordinate.x - this.x
    this.whereUserClicked.y = coordinate.y - this.y
  },
  contains: function (coordinate: { x: number; y: number }) {
    return (
      coordinate.x >= this.x &&
      coordinate.x <= this.x + this.width &&
      coordinate.y >= this.y &&
      coordinate.y <= this.y + this.height
    )
  },
  outterZoneDetection: function (coordinate: { x: number; y: number }) {
    //
    return (
      coordinate.x >= this.x - this.outterLayer &&
      coordinate.x <= this.x + this.width + this.outterLayer &&
      coordinate.y >= this.y - this.outterLayer &&
      coordinate.y <= this.y + this.height + this.outterLayer
    )
  },
  move: function (x: number, y: number) {
    this.x = x - this.whereUserClicked.x
    this.y = y - this.whereUserClicked.y
  },
  checkLeftZone: function (coordinate: { x: number }) {
    //
    return coordinate.x >= this.x - this.outterLayer && coordinate.x <= this.x
  },
  checkRightZone: function (coordinate: { x: number }) {
    return (
      coordinate.x >= this.x + this.width && coordinate.x <= this.x + this.width + this.outterLayer
    )
  },
  checkTopZone: function (coordinate: { y: number }) {
    return coordinate.y <= this.y && coordinate.y >= this.y - this.outterLayer
  },
  checkBottomZone: function (coordinate: { y: number }) {
    return (
      coordinate.y >= this.y + this.height &&
      coordinate.y <= this.y + this.height + this.outterLayer
    )
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

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  canvasBackground() // redraws the background
  cursor.value.crosshair = true // this is used to show the crosshair cursor when the user is drawing

  const startX = Math.min(x1, x2)
  const startY = Math.min(y1, y2)
  const width = Math.abs(x2 - x1) // subtracting coordinates gives the distance between two areas
  const height = Math.abs(y2 - y1)

  // storing the rectangle coordinates and size in the rectangle object
  rectangle.x = startX
  rectangle.y = startY
  rectangle.width = width
  rectangle.height = height

  paintIt(startX, startY, width, height) // this function is used to draw the rectangle on the canvas
}

// model function to move the rectangle
const movingRectangle = (x: number, y: number) => {
  const Canvas = editorCanvas.value
  const ctx = Canvas.getContext('2d')

  ctx.clearRect(0, 0, Canvas.width, Canvas.height)
  canvasBackground() //redraws the background

  // updating the rectangle object with the new coordinates and size with the mouse click
  rectangle.move(x, y)

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
  const canvas = editorCanvas.value
  const canvasSpace = canvas.getBoundingClientRect()
  const scaleX = canvas.width / canvasSpace.width // get the scale of the canvas example: 1600/800 = 2 this mean it has double the pixel width
  const scaleY = canvas.height / canvasSpace.height
  return {
    x: (action.clientX - canvasSpace.left) * scaleX,
    y: (action.clientY - canvasSpace.top) * scaleY,
  }
}

// controller function to check if the user is clicking on the canvas, if the user is clicking on the rectangle, if the user is clicking on the outter zone of the rectangle, or if the user is drawing a new rectangle.
const mouseDownOnCanvas = (action: MouseEvent) => {
  const noController = controller.value
  const { x, y } = getMousePositionOnCanvas(action)
  coordinate.x = x
  coordinate.y = y

  if (rectangle.contains(coordinate)) {
    rectangle.storeUserClick(coordinate)

    controller.value = {
      ...noController,
      isDraggable: true,
    }
  } else if (rectangle.outterZoneDetection(coordinate)) {
    cursor.value.sizingDirection.left = rectangle.checkLeftZone(coordinate)
    cursor.value.sizingDirection.right = rectangle.checkRightZone(coordinate)
    cursor.value.sizingDirection.top = rectangle.checkTopZone(coordinate)
    cursor.value.sizingDirection.bottom = rectangle.checkBottomZone(coordinate)

    controller.value = {
      ...noController,
      isResizing: true,
    }
  } else {
    controller.value = {
      ...noController,
      isDrawing: true,
    }
  }
}

const mouseUpOnCanvas = () => {
  // controller function to check if the user releases the mouse button on the canvas. Resets the controller flags and cursor state
  controller.value = {
    isDrawing: false,
    isDraggable: false,
    isResizing: false,
  }
  cursor.value.sizingDirection = {
    left: false,
    right: false,
    top: false,
    bottom: false,
  }
}

const mouseMoveOnCanvas = (action: MouseEvent) => {
  // controller function to check if the user is moving the mouse on the canvas
  const { x, y } = getMousePositionOnCanvas(action)
  const temp = { x: x, y: y }

  if (
    !controller.value.isDraggable &&
    !controller.value.isResizing &&
    !controller.value.isDrawing
  ) {
    // check if the user is not dragging or resizing the rectangle
    cursor.value.hovering = rectangle.contains(temp)
  }

  if (controller.value.isDraggable) {
    movingRectangle(x, y)
  } else if (controller.value.isResizing) {
    resizingRectangle(x, y)
  } else if (controller.value.isDrawing) {
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
        :class="{canvas: cursor.crosshair, hover: cursor.hovering, dragging: controller.isDraggable,'resize-left': cursor.sizingDirection.left, 'resize-right': cursor.sizingDirection.right, 'resize-top': cursor.sizingDirection.top, 'resize-bottom': cursor.sizingDirection.bottom, 'top-left-corner': cursor.sizingDirection.left && cursor.sizingDirection.top, 'top-right-corner': cursor.sizingDirection.right && cursor.sizingDirection.top, 'bottom-left-corner': cursor.sizingDirection.left && cursor.sizingDirection.bottom, 'bottom-right-corner': cursor.sizingDirection.right && cursor.sizingDirection.bottom}"
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
