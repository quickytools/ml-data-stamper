<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'

const editorCanvas = ref()
const editorCanvasWidth = ref(0)
const editorCanvasHeight = ref(0)
const scale = ref(1) // this is the scale factor for the canvas, used for zooming in and out
const controller = ref({
  isDrawing: false,
  isDraggable: false,
  isResizing: false,
  isPanning: false,
}) // this is the controller object that will be used to control the annotation box
const cursor = ref({
  sizingDirection: { left: false, right: false, top: false, bottom: false },
  hovering: false,
  crosshair: false,
})
const panState = ref({
  // this holds the state of the panning functionality
  offSet: { x: 0, y: 0 },
  lastPosition: { x: 0, y: 0 },
})
const coordinate = { x: 0, y: 0 } // this is the coordinate object that will be used to store the mouse position on the canvas
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

function drawCheckerboard(canvas, { startX, startY, width, height, lightColor, darkColor }) {
  const ctx = canvas.getContext('2d')
  const x0 = Math.round(startX * 0.1) * 10
  const y0 = Math.round(startY * 0.1) * 10
  for (let i = 0; i <= height / 10; i++) {
    for (let j = 0; j <= width / 10; j++) {
      const x = x0 + j * 10
      const y = y0 + i * 10
      ctx.fillStyle = ((x + y) * 0.1) % 2 ? lightColor : darkColor
      ctx.fillRect(x, y, 10, 10)
    }
  }
}

const canvasBackground = () => {
  const canvas = editorCanvas.value
  const ctx = canvas.getContext('2d')
  const { a, e, f } = ctx.getTransform()

  const inverseScale = a > 0 ? 1 / a : 1
  const canvasWidth = canvas.width
  const canvasHeight = canvas.height
  const scaledHeight = canvasHeight * inverseScale
  const scaledWidth = canvasWidth * inverseScale
  const startX = -e * inverseScale
  const startY = -f * inverseScale

  ctx.clearRect(startX, startY, scaledWidth, scaledHeight)

  drawCheckerboard(canvas, {
    startX,
    startY,
    width: scaledWidth,
    height: scaledHeight,
    lightColor: 'rgba(255, 255, 255, 0.80)',
    darkColor: 'rgba(0, 0, 0, 0.05)',
  })
}

const zoom = (coordinate: { x: number; y: number }, deltaY: number) => {
  const canvas = editorCanvas.value
  const ctx = canvas.getContext('2d')

  /*
   * a b e
   * c d f
   *
   * xform.a = xform.d = zoom
   * xform.b = xform.c = 0
   * xform.e = x pan
   * xform.f = y pan
   */
  const xform = ctx.getTransform()

  const prevScale = xform.a

  let newScale = prevScale + deltaY * -0.01 // Adjust the zoom speed as needed
  newScale = Math.min(Math.max(0.5, newScale), 10)

  const scaleChange = newScale / prevScale

  const { x, y } = xform.transformPoint(new DOMPoint(coordinate.x, coordinate.y))
  const updatedXform = new DOMMatrix()
    .translate(x, y)
    .scale(scaleChange)
    .translate(-x, -y)
    .multiply(xform)

  const limitOffSet = canvasBoundary(updatedXform.e, updatedXform.f, newScale)

  panState.value.offSet = limitOffSet
  scale.value = newScale

  ctx.setTransform(updatedXform)

  canvasBackground() // redraws the background
  paintIt(rectangle.x, rectangle.y, rectangle.width, rectangle.height) // redraw the rectangle
}

const moveCanvasView = (action: MouseEvent) => {
  const deltaX = action.clientX - panState.value.lastPosition.x // calculate the difference in mouse position from the last position
  const deltaY = action.clientY - panState.value.lastPosition.y
  const newPan = {
    x: panState.value.offSet.x + deltaX,
    y: panState.value.offSet.y + deltaY,
  }
  const limitOffset = canvasBoundary(newPan.x, newPan.y, undefined)
  panState.value.offSet = limitOffset // limit the pan offset to the canvas boundary and set the new pan offset
  panState.value.lastPosition = { x: action.clientX, y: action.clientY } // update the last pan position to the current mouse position

  const canvas = editorCanvas.value
  const ctx = canvas.getContext('2d')
  ctx.setTransform(
    scale.value,
    0,
    0,
    scale.value,
    limitOffset.x, // adjust the viewport to pan where the mouse is
    limitOffset.y,
  )
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  canvasBackground()
  paintIt(rectangle.x, rectangle.y, rectangle.width, rectangle.height) // redraw the rectangl
}

const canvasBoundary = (panX: number, panY: number, newScale: number | undefined) => {
  const canvas = editorCanvas.value
  // Calculate how much the canvas has grown due to scaling
  const scaleToUse = newScale != null ? newScale : scale.value
  const scaledWidth = canvas.width * scaleToUse
  const scaledHeight = canvas.height * scaleToUse

  // Calculate maximum allowed pan distances
  const viewWidth = editorCanvasWidth.value
  const viewHeight = editorCanvasHeight.value

  const minPanX = viewWidth - scaledWidth
  const minPanY = viewHeight - scaledHeight

  return {
    x: Math.min(Math.max(panX, minPanX), 0),
    y: Math.min(Math.max(panY, minPanY), 0),
  }
}

const drawOnCanvas = (x1: number, y1: number, x2: number, y2: number) => {
  const canvas = editorCanvas.value
  const ctx = canvas.getContext('2d')

  canvasBackground() // redraws the background
  cursor.value.crosshair = true // this is used to show the crosshair cursor when the user is drawing

  const startX = Math.min(x1, x2)
  const startY = Math.min(y1, y2)
  const width = Math.abs(x2 - x1)
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

  canvasBackground() //redraws the background

  // updating the rectangle object with the new coordinates and size with the mouse click
  rectangle.move(x, y)

  paintIt(rectangle.x, rectangle.y, rectangle.width, rectangle.height)
}

// model function to resize the rectangle
const resizingRectangle = (x: number, y: number) => {
  const canvas = editorCanvas.value
  const ctx = canvas.getContext('2d')

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

function getMousePositionOnCanvas(action: MouseEvent) {
  const canvas = editorCanvas.value
  const ctx = canvas.getContext('2d')

  const x = action.offsetX
  const y = action.offsetY

  const transform = ctx.getTransform()
  const transformedPoint = new DOMPoint(x, y).matrixTransform(transform.inverse())

  return {
    x: transformedPoint.x,
    y: transformedPoint.y,
  }
}

const mouseDownOnCanvas = (action: MouseEvent) => {
  const noController = controller.value
  const { x, y } = getMousePositionOnCanvas(action)
  coordinate.x = x
  coordinate.y = y

  if (action.button === 0 && action.ctrlKey) {
    controller.value = {
      ...noController,
      isPanning: true,
    }
    panState.value.lastPosition = { x: action.clientX, y: action.clientY }
  } else if (rectangle.contains(coordinate)) {
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

const mouseWheelOnCanvas = (action: WheelEvent) => {
  action.preventDefault() // prevent the default scrolling behavior
  const { x, y } = getMousePositionOnCanvas(action)
  coordinate.x = x
  coordinate.y = y
  zoom(coordinate, action.deltaY)
}

const mouseUpOnCanvas = () => {
  controller.value = {
    isDrawing: false,
    isDraggable: false,
    isResizing: false,
    isPanning: false,
  }
  cursor.value.sizingDirection = {
    left: false,
    right: false,
    top: false,
    bottom: false,
  }
}

const mouseMoveOnCanvas = (action: MouseEvent) => {
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

  if (controller.value.isPanning) {
    moveCanvasView(action)
  } else if (controller.value.isDraggable) {
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
div
    p Bounding box editor
    canvas(
        ref="editorCanvas"
        :width='editorCanvasWidth'
        :height='editorCanvasHeight'
        :class="{canvas: cursor.crosshair, hover: cursor.hovering, dragging: controller.isDraggable,'resize-left': cursor.sizingDirection.left, 'resize-right': cursor.sizingDirection.right, 'resize-top': cursor.sizingDirection.top, 'resize-bottom': cursor.sizingDirection.bottom, 'top-left-corner': cursor.sizingDirection.left && cursor.sizingDirection.top, 'top-right-corner': cursor.sizingDirection.right && cursor.sizingDirection.top, 'bottom-left-corner': cursor.sizingDirection.left && cursor.sizingDirection.bottom, 'bottom-right-corner': cursor.sizingDirection.right && cursor.sizingDirection.bottom}"
        @mousedown="mouseDownOnCanvas"
        @mousemove="mouseMoveOnCanvas"
        @mouseup="mouseUpOnCanvas"
        @wheel="mouseWheelOnCanvas"
    )
    p Use mouse wheel to zoom. Use Ctrl + left mouse click to move around the canvas after zooming.
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
