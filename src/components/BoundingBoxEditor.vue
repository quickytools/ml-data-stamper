<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { SelectionArea } from '../box-editor/SelectionArea'
import { useVideoStore } from '../stores/videoStore'

const editorCanvas = ref()
const editorCanvasWidth = ref(0)
const editorCanvasHeight = ref(0)
const editorScale = ref(1) // this is the scale factor for the canvas, used for zooming in and out
const videoStore = useVideoStore() // stored videoFrames
const canvasInteractionState = ref({
  isDrawing: false,
  isDraggable: false,
  isResizing: false,
  isPanning: false,
}) // this is the controller object that will be used to control the annotation box
const interactionCursor = ref({
  sizingDirection: { left: false, right: false, top: false, bottom: false },
  hovering: false,
  crosshair: false,
})
const panState = {
  zeroCoordinates: { x: 0, y: 0 },
  startPanCoordinates: { x: 0, y: 0 },
  onStart: function (zeroCoordinates, startPanCoordinates) {
    this.zeroCoordinates = zeroCoordinates
    this.startPanCoordinates = startPanCoordinates
  },
  onMove: function (currentPanCoordinates) {
    const { x: zx, y: zy } = this.zeroCoordinates
    const { x: sx, y: sy } = this.startPanCoordinates
    const { x, y } = currentPanCoordinates
    return {
      x: zx + x - sx,
      y: zy + y - sy,
    }
  },
}
const mouseCanvasCoordinate = { x: 0, y: 0 } // this is the coordinate object that will be used to store the mouse position on the canvas
const selectionArea = new SelectionArea() //annotation box

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

const zoom = (mouseCoordinate: { x: number; y: number }, deltaY: number) => {
  const canvas = editorCanvas.value
  const ctx = canvas.getContext('2d')

  const xform = ctx.getTransform()

  const prevScale = xform.a

  let newScale = prevScale + deltaY * -0.01 // Adjust the zoom speed as needed
  newScale = Math.min(Math.max(0.5, newScale), 10)

  const scaleChange = newScale / prevScale

  const { x, y } = mouseCoordinate
  const updatedXform = new DOMMatrix()
    .translate(x, y)
    .scale(scaleChange)
    .translate(-x, -y)
    .multiply(xform)

  editorScale.value = newScale

  ctx.setTransform(updatedXform)

  canvasBackground() // redraws the background
  paintIt(selectionArea) // redraw the rectangle
}

const moveCanvasView = (action: MouseEvent) => {
  const currentCoordinates = { x: action.clientX, y: action.clientY }
  const { x, y } = panState.onMove(currentCoordinates)
  const ctx = editorCanvas.value.getContext('2d')
  const { a } = ctx.getTransform()
  ctx.setTransform(a, 0, 0, a, x, y)

  canvasBackground()
  paintIt(selectionArea)
}

const drawOnCanvas = (x1: number, y1: number, x2: number, y2: number) => {
  const canvas = editorCanvas.value
  const ctx = canvas.getContext('2d')

  canvasBackground() // redraws the background
  interactionCursor.value.crosshair = true // this is used to show the crosshair cursor when the user is drawing

  const startX = Math.min(x1, x2)
  const startY = Math.min(y1, y2)
  const width = Math.abs(x2 - x1)
  const height = Math.abs(y2 - y1)

  // storing the rectangle coordinates and size in the rectangle object
  selectionArea.x = startX
  selectionArea.y = startY
  selectionArea.width = width
  selectionArea.height = height

  paintIt(selectionArea) // this function is used to draw the rectangle on the canvas
}

// model function to move the rectangle
const movingRectangle = (x: number, y: number) => {
  const Canvas = editorCanvas.value
  const ctx = Canvas.getContext('2d')

  canvasBackground() //redraws the background

  // updating the rectangle object with the new coordinates and size with the mouse click
  selectionArea.move(x, y)

  paintIt(selectionArea)
}

// model function to resize the rectangle
const resizingRectangle = (x: number, y: number) => {
  const canvas = editorCanvas.value
  const ctx = canvas.getContext('2d')

  canvasBackground()

  // Handle each side resizing
  if (interactionCursor.value.sizingDirection.left) {
    const newWidth = selectionArea.x + selectionArea.width - x
    if (newWidth >= selectionArea.outerLayer) {
      selectionArea.x = x
      selectionArea.width = newWidth
    }
  }
  if (interactionCursor.value.sizingDirection.right) {
    const newWidth = x - selectionArea.x
    if (newWidth >= selectionArea.outerLayer) {
      selectionArea.width = newWidth
    }
  }
  if (interactionCursor.value.sizingDirection.top) {
    const newHeight = selectionArea.y + selectionArea.height - y
    if (newHeight >= selectionArea.outerLayer) {
      selectionArea.y = y
      selectionArea.height = newHeight
    }
  }
  if (interactionCursor.value.sizingDirection.bottom) {
    const newHeight = y - selectionArea.y
    if (newHeight >= selectionArea.outerLayer) {
      selectionArea.height = newHeight
    }
  }

  paintIt(selectionArea)
}

// view function for user to see the rectangle
const paintIt = (area: { x: number; y: number; width: number; height: number }) => {
  const canvas = editorCanvas.value
  const ctx = canvas.getContext('2d')
  ctx.beginPath()
  ctx.fillStyle = 'rgba(255, 0, 0, 0.05)'
  ctx.fillRect(area.x, area.y, area.width, area.height)
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
  const noController = canvasInteractionState.value
  const { x, y } = getMousePositionOnCanvas(action)
  mouseCanvasCoordinate.x = x
  mouseCanvasCoordinate.y = y

  if ((action.button === 0 && action.ctrlKey) || action.button === 1) {
    canvasInteractionState.value = {
      ...noController,
      isPanning: true,
    }
    const { e, f } = editorCanvas.value.getContext('2d').getTransform()
    panState.onStart({ x: e, y: f }, { x: action.clientX, y: action.clientY })
  } else if (selectionArea.contains(mouseCanvasCoordinate)) {
    selectionArea.storeUserClick(mouseCanvasCoordinate)

    canvasInteractionState.value = {
      ...noController,
      isDraggable: true,
    }
  } else if (selectionArea.outerZoneDetection(mouseCanvasCoordinate)) {
    interactionCursor.value.sizingDirection.left =
      selectionArea.checkLeftZone(mouseCanvasCoordinate)
    interactionCursor.value.sizingDirection.right =
      selectionArea.checkRightZone(mouseCanvasCoordinate)
    interactionCursor.value.sizingDirection.top = selectionArea.checkTopZone(mouseCanvasCoordinate)
    interactionCursor.value.sizingDirection.bottom =
      selectionArea.checkBottomZone(mouseCanvasCoordinate)

    canvasInteractionState.value = {
      ...noController,
      isResizing: true,
    }
  } else {
    canvasInteractionState.value = {
      ...noController,
      isDrawing: true,
    }
  }
}

const mouseWheelOnCanvas = (action: WheelEvent) => {
  if (canvasInteractionState.value.isPanning) {
    return
  }

  action.preventDefault() // prevent the default scrolling behavior

  const { x, y } = getMousePositionOnCanvas(action)
  mouseCanvasCoordinate.x = x
  mouseCanvasCoordinate.y = y

  zoom({ x: action.offsetX, y: action.offsetY }, action.deltaY)
}

const mouseUpOnCanvas = () => {
  canvasInteractionState.value = {
    isDrawing: false,
    isDraggable: false,
    isResizing: false,
    isPanning: false,
  }
  interactionCursor.value.sizingDirection = {
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
    !canvasInteractionState.value.isDraggable &&
    !canvasInteractionState.value.isResizing &&
    !canvasInteractionState.value.isDrawing
  ) {
    // check if the user is not dragging or resizing the rectangle
    interactionCursor.value.hovering = selectionArea.contains(temp)
  }

  if (canvasInteractionState.value.isPanning) {
    moveCanvasView(action)
  } else if (canvasInteractionState.value.isDraggable) {
    movingRectangle(x, y)
  } else if (canvasInteractionState.value.isResizing) {
    resizingRectangle(x, y)
  } else if (canvasInteractionState.value.isDrawing) {
    drawOnCanvas(mouseCanvasCoordinate.x, mouseCanvasCoordinate.y, x, y)
  }
}

const keyUpOnCanvas = (keyCode) => {
  switch (keyCode) {
    case 'KeyF':
      const canvas = editorCanvas.value
      const ctx = canvas.getContext('2d')
      if (selectionArea.isDefined()) {
        const xform = ctx.getTransform()
        ctx.setTransform(selectionArea.getBoundingTransform(xform))
      } else {
        ctx.setTransform(new DOMMatrix())
      }
      canvasBackground()
      paintIt(selectionArea.x, selectionArea.y, selectionArea.width, selectionArea.height)
      break
  }
}

const keyOnCanvas = (e: MouseEvent) => {
  switch (e.type) {
    case 'keyup':
      keyUpOnCanvas(e.code)
      break
  }
}

document.addEventListener('keyup', keyOnCanvas)

watch()

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
        :class="{canvas: interactionCursor.crosshair, hover: interactionCursor.hovering, dragging: canvasInteractionState.isDraggable, 'resize-left': interactionCursor.sizingDirection.left, 'resize-right': interactionCursor.sizingDirection.right, 'resize-top': interactionCursor.sizingDirection.top, 'resize-bottom': interactionCursor.sizingDirection.bottom, 'top-left-corner': interactionCursor.sizingDirection.left && interactionCursor.sizingDirection.top, 'top-right-corner': interactionCursor.sizingDirection.right && interactionCursor.sizingDirection.top, 'bottom-left-corner': interactionCursor.sizingDirection.left && interactionCursor.sizingDirection.bottom, 'bottom-right-corner': interactionCursor.sizingDirection.right && interactionCursor.sizingDirection.bottom}"
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
