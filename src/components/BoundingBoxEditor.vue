<script setup lang="ts">
import { ref, onMounted, nextTick, watchEffect } from 'vue'
import { SelectionArea } from '../box-editor/SelectionArea'
import { useVideoStore } from '../stores/videoStore'
import { CanvasRenderer } from '../box-editor/CanvasRenderer'

const editorCanvas = ref()
const editorCanvasWidth = ref(0)
const editorCanvasHeight = ref(0)
const editorScale = ref(1) //  scale factor for the canvas, used for zooming in and out
const videoStore = useVideoStore() // stored videoFrames use videoStore.currentFrame
const isCanvasReady = ref(false)
const canvasInteractionState = ref({
  isDrawing: false,
  isDraggable: false,
  isResizing: false,
  isPanning: false,
})
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
const selectionArea = new SelectionArea() // annotation box
let canvasRenderer: CanvasRenderer
watchEffect(() => {
    if(isCanvasReady.value &&videoStore.currentFrame){
      canvasRenderer.canvasBackground()
    }
  })
const mouseDownOnCanvas = (action: MouseEvent) => {
  const noController = canvasInteractionState.value
  const { x, y } = canvasRenderer.getMousePositionOnCanvas(action)
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

  action.preventDefault()

  const { x, y } = canvasRenderer.getMousePositionOnCanvas(action)
  mouseCanvasCoordinate.x = x
  mouseCanvasCoordinate.y = y

  canvasRenderer.zoom({ x: action.offsetX, y: action.offsetY }, action.deltaY)
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
  const { x, y } = canvasRenderer.getMousePositionOnCanvas(action)
  const temp = { x: x, y: y }

  if (
    !canvasInteractionState.value.isDraggable &&
    !canvasInteractionState.value.isResizing &&
    !canvasInteractionState.value.isDrawing
  ) {
    interactionCursor.value.hovering = selectionArea.contains(temp)
  }

  if (canvasInteractionState.value.isPanning) {
    canvasRenderer.moveCanvasView(action)
  } else if (canvasInteractionState.value.isDraggable) {
    canvasRenderer.movingRectangle(x, y)
  } else if (canvasInteractionState.value.isResizing) {
    canvasRenderer.resizingRectangle(x, y)
  } else if (canvasInteractionState.value.isDrawing) {
    canvasRenderer.drawOnCanvas(mouseCanvasCoordinate.x, mouseCanvasCoordinate.y, x, y)
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
      canvasRenderer.canvasBackground()
      canvasRenderer.paintIt(selectionArea)
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

onMounted(() => {
  const canvasWidth = 600
  const canvasHeight = 400
  editorCanvasWidth.value = canvasWidth
  editorCanvasHeight.value = canvasHeight

    nextTick(()=>{
      if(editorCanvas.value){
      canvasRenderer = new CanvasRenderer( // canvas space
      editorCanvas.value,
      () => videoStore.currentFrame,
      editorScale.value,
      panState,
      selectionArea,
      interactionCursor.value,
    )
    isCanvasReady.value = true
    // Wait for next animation frame before drawing on canvas or draw calls are dropped
    window.requestAnimationFrame(canvasRenderer.canvasBackground)
   }
  })
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
