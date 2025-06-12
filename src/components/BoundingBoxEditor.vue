<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { BorderSide, SelectionArea } from '../box-editor/SelectionArea'
import { CanvasRenderer } from '../box-editor/CanvasRenderer'
import LoadVideo from './LoadVideo.vue'

const editorCanvas = ref()
const editorCanvasWidth = ref(0)
const editorCanvasHeight = ref(0)
const editorScale = ref(1) //  scale factor for the canvas, used for zooming in and out
const isCanvasReady = ref(false)
const currentFrame = ref(null)
const canvasInteractionState = ref({
  isDrawing: false,
  isDraggable: false,
  isResizing: false,
  isPanning: false,
})
const interactionCursor = ref({
  resizeBorder: BorderSide.None,
  hovering: false,
  crosshair: false,
})
const topBorderSides = new Set([BorderSide.Top, BorderSide.TopRight, BorderSide.TopLeft])
const rightBorderSides = new Set([BorderSide.Right, BorderSide.TopRight, BorderSide.BottomRight])
const bottomBorderSides = new Set([
  BorderSide.Bottom,
  BorderSide.BottomRight,
  BorderSide.BottomLeft,
])
const leftBorderSides = new Set([BorderSide.Left, BorderSide.TopLeft, BorderSide.BottomLeft])

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

watch(currentFrame, async (currentFrame) => {
  // watches for frame changes
  if (isCanvasReady.value && currentFrame != null) {
    await canvasRenderer.setVideoFrame(currentFrame)
    canvasRenderer.canvasBackground()
  }
})

const mouseDownOnCanvas = (action: MouseEvent) => {
  const interactionState = canvasInteractionState.value
  const { x, y } = canvasRenderer.getMousePositionOnCanvas(action)
  mouseCanvasCoordinate.x = x
  mouseCanvasCoordinate.y = y

  if ((action.button === 0 && action.ctrlKey) || action.button === 1) {
    canvasInteractionState.value = {
      ...interactionState,
      isPanning: true,
    }
    const { e, f } = editorCanvas.value.getContext('2d').getTransform()
    panState.onStart({ x: e, y: f }, { x: action.clientX, y: action.clientY })
  } else {
    const { isInside, isOutside, borderSide } = selectionArea.detectRegion(mouseCanvasCoordinate)

    interactionCursor.value.resizeBorder = borderSide

    if (isInside) {
      selectionArea.storeUserClick(mouseCanvasCoordinate)

      canvasInteractionState.value = {
        ...interactionState,
        isDraggable: true,
      }
    } else if (borderSide != BorderSide.None) {
      canvasInteractionState.value = {
        ...interactionState,
        isResizing: true,
      }
    } else {
      canvasInteractionState.value = {
        ...interactionState,
        isDrawing: true,
      }
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
  interactionCursor.value.resizeBorder = BorderSide.None
}

const mouseMoveOnCanvas = (action: MouseEvent) => {
  const { x, y } = canvasRenderer.getMousePositionOnCanvas(action)

  const { isPanning, isDraggable, isResizing, isDrawing } = canvasInteractionState.value

  const borderSide = interactionCursor.value.resizeBorder
  const isHovering = !(isDraggable || isResizing || isDrawing)

  let showHover = isHovering
  let showCrosshair = isDrawing
  let showBorderResize = borderSide

  if (isPanning) {
    canvasRenderer.moveCanvasView(action)
  } else if (isDraggable) {
    canvasRenderer.movingRectangle(x, y)
  } else if (isResizing) {
    canvasRenderer.resizingRectangle(
      { x, y },
      {
        isTop: topBorderSides.has(borderSide),
        isRight: rightBorderSides.has(borderSide),
        isBottom: bottomBorderSides.has(borderSide),
        isLeft: leftBorderSides.has(borderSide),
      },
    )
  } else if (isDrawing) {
    canvasRenderer.drawOnCanvas(mouseCanvasCoordinate.x, mouseCanvasCoordinate.y, x, y)
  } else {
    const {
      isInside,
      isOutside,
      borderSide: hoverBorderSide,
    } = selectionArea.detectRegion({ x, y })
    showBorderResize = hoverBorderSide
    showCrosshair = isOutside
    showHover = isInside
  }

  interactionCursor.value = {
    resizeBorder: showBorderResize,
    hovering: showHover,
    crosshair: showCrosshair,
  }
}

const keyUpOnCanvas = (keyCode) => {
  switch (keyCode) {
    case 'KeyF':
      const canvas = editorCanvas.value
      const ctx = canvas.getContext('2d')
      if (selectionArea.isDefined) {
        const xform = ctx.getTransform()
        ctx.setTransform(selectionArea.getBoundingTransform(xform))
      } else {
        ctx.setTransform(new DOMMatrix())
      }
      canvasRenderer.canvasBackground()
      canvasRenderer.drawRect(selectionArea)
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

  nextTick(() => {
    if (editorCanvas.value) {
      canvasRenderer = new CanvasRenderer(
        editorCanvas.value,
        currentFrame.value,
        editorScale.value,
        panState,
        selectionArea,
      )
      isCanvasReady.value = true
      window.requestAnimationFrame(canvasRenderer.canvasBackground)
    }
  })
})

const onFrameChange = (e) => {
  currentFrame.value = e.content
}
</script>

<template lang="pug">
div
    p Bounding box editor
    LoadVideo(:isEventEmitter="true" @frameChange='onFrameChange')
    canvas(
        ref="editorCanvas"
        :width='editorCanvasWidth'
        :height='editorCanvasHeight'
        :class="{canvas: interactionCursor.crosshair, hover: interactionCursor.hovering, dragging: canvasInteractionState.isDraggable, 'resize-left': interactionCursor.resizeBorder==BorderSide.Left, 'resize-right': interactionCursor.resizeBorder==BorderSide.Right, 'resize-top': interactionCursor.resizeBorder==BorderSide.Top, 'resize-bottom': interactionCursor.resizeBorder==BorderSide.Bottom, 'top-left-corner': interactionCursor.resizeBorder==BorderSide.TopLeft, 'top-right-corner': interactionCursor.resizeBorder==BorderSide.TopRight, 'bottom-left-corner': interactionCursor.resizeBorder==BorderSide.BottomLeft, 'bottom-right-corner': interactionCursor.resizeBorder==BorderSide.BottomRight}"
        @mousedown="mouseDownOnCanvas"
        @mousemove="mouseMoveOnCanvas"
        @mouseup="mouseUpOnCanvas"
        @wheel="mouseWheelOnCanvas"
    )
    p Use mouse wheel to zoom. Use Ctrl + left mouse click to move around the canvas after zooming or middle mouse click.
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
