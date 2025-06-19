<script setup lang="ts">
import { ref, onMounted, nextTick, watch, toRaw, onBeforeUnmount } from 'vue'
import { BorderSide, SelectionArea } from '../box-editor/SelectionArea'
import { CanvasRenderer } from '../box-editor/CanvasRenderer'
import LoadVideo from './LoadVideo.vue'
import { YoloObjectDetector } from '../object-detection/YoloObjectDetector'

const editorCanvas = ref()
const editorCanvasWidth = ref(0)
const editorCanvasHeight = ref(0)
const isCanvasReady = ref(false)
const imageData = ref<{
  content: ImageData
  width: number
  height: number
} | null>(null)
const isLoadingDetector = ref(false)
const isDetectingObjects = ref(false)
const canvasInteractionState = ref({
  isDrawing: false,
  isDraggable: false,
  isResizing: false,
  resizeSide: {
    isTop: false,
    isRight: false,
    isBottom: false,
    isLeft: false,
  },
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

const canvasCoordinates = { x: 0, y: 0 }
const selectionArea = new SelectionArea()
const objectDetector = new YoloObjectDetector()
let detectDelayTimer: ReturnType<typeof window.setTimeout>
let canvasRenderer: CanvasRenderer

objectDetector.addEventListener('loading', ({ detail }) => {
  isLoadingDetector.value = detail
})
objectDetector.addEventListener('detecting', ({ detail }) => {
  isDetectingObjects.value = detail
})

const loadDetector = async () => {
  await objectDetector.load()
}

const detectObjects = async (imageData) => {
  return objectDetector.detect(imageData)
}

function imageDataToCanvas(imageData: ImageData) {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height

  const ctx = canvas.getContext('2d')
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

watch(imageData, async (currentFrame) => {
  // watches for frame changes
  if (isCanvasReady.value && currentFrame != null) {
    try {
      const rawContent = toRaw(currentFrame.content)
      const bitImage = await createImageBitmap(rawContent)
      await canvasRenderer.setVideoFrame(bitImage)
      canvasRenderer.canvasBackground()
      clearTimeout(detectDelayTimer)
      detectDelayTimer = setTimeout(async () => {
        try {
          const convertedImage = imageDataToCanvas(currentFrame.content)
          const detected = await detectObjects(convertedImage)
          console.log('detected: ', detected)
        } catch (e) {
          console.error('failed to convert ImageData from currentFrame.content: ', e)
        }
      }, 300)
    } catch (e) {
      console.error('failed to create imageBitMap from currentFrame.content: ', e)
    }
  }
})

const getCanvasCoordinates = (action: MouseEvent) =>
  canvasRenderer.getCanvasCoordinates({ x: action.offsetX, y: action.offsetY })

const mouseDownOnCanvas = (action: MouseEvent) => {
  const { x, y } = getCanvasCoordinates(action)
  canvasCoordinates.x = x
  canvasCoordinates.y = y

  const interactionState = canvasInteractionState.value
  if ((action.button === 0 && action.ctrlKey) || action.button === 1) {
    canvasInteractionState.value = {
      ...interactionState,
      isPanning: true,
    }
    const { e, f } = editorCanvas.value.getContext('2d').getTransform()
    panState.onStart({ x: e, y: f }, { x: action.clientX, y: action.clientY })
  } else {
    const { isInside, isOutside, borderSide } = selectionArea.detectRegion(canvasCoordinates)

    interactionCursor.value.resizeBorder = borderSide

    if (isInside) {
      selectionArea.storeUserClick(canvasCoordinates)

      canvasInteractionState.value = {
        ...interactionState,
        isDraggable: true,
      }
    } else if (borderSide != BorderSide.None) {
      canvasInteractionState.value = {
        ...interactionState,
        isResizing: true,
        resizeSide: {
          isTop: topBorderSides.has(borderSide),
          isRight: rightBorderSides.has(borderSide),
          isBottom: bottomBorderSides.has(borderSide),
          isLeft: leftBorderSides.has(borderSide),
        },
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

  const { x, y } = getCanvasCoordinates(action)
  canvasCoordinates.x = x
  canvasCoordinates.y = y

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
  const { x, y } = getCanvasCoordinates(action)

  const { isPanning, isDraggable, isResizing, isDrawing, resizeSide } = canvasInteractionState.value

  const borderSide = interactionCursor.value.resizeBorder
  const isHovering = !(isDraggable || isResizing || isDrawing)

  let showHover = isHovering
  let showCrosshair = isDrawing
  let showBorderResize = borderSide

  if (isPanning) {
    const currentCoordinates = { x: action.clientX, y: action.clientY }
    const { x, y } = panState.onMove(currentCoordinates)
    canvasRenderer.panCanvasView({ x, y })
  } else if (isDraggable) {
    canvasRenderer.updateSelectionPosition(x, y)
  } else if (isResizing) {
    canvasRenderer.resizeSelectionArea({ x, y }, resizeSide)
  } else if (isDrawing) {
    canvasRenderer.drawOnCanvas(canvasCoordinates.x, canvasCoordinates.y, x, y)
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
      canvasRenderer = new CanvasRenderer(editorCanvas.value, imageData.value, selectionArea)
      loadDetector()
      isCanvasReady.value = true
      window.requestAnimationFrame(canvasRenderer.canvasBackground)
    }
  })
})

const onFrameChange = (e) => {
  imageData.value = e
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
