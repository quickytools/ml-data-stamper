<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'

import { BorderSide, SelectionArea } from '../box-editor/SelectionArea'

import { CanvasRenderer } from '../box-editor/CanvasRenderer'
import { YoloObjectDetector } from '../object-detection/YoloObjectDetector'

const props = defineProps({
  imageContent: {
    type: Object, // ImageContent
  },
})

const emit = defineEmits<{
  /**
   * On request change in frame
   */
  seekFrame: [delta: number]
}>()

const canvasContainer = ref()

const editorCanvas = ref()
const editorCanvasWidth = ref(0)
const editorCanvasHeight = ref(0)
const isCanvasReady = ref(false)

const isLoadingDetector = ref(false)
const isDetectingObjects = ref(false)

const canvasInteractionState = ref({
  isDrawing: false,
  isDragging: false,
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

const selectionArea = new SelectionArea()
const objectDetector = new YoloObjectDetector()
let detectDelayTimer: ReturnType<typeof window.setTimeout>
let canvasRenderer: CanvasRenderer

let isMouseOverCanvas = false
let isSpacedPressedOverCanvas = false

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

watch(
  () => props.imageContent,
  async (currentFrame) => {
    if (isCanvasReady.value && currentFrame != null) {
      try {
        const frameImage = await createImageBitmap(currentFrame.content)
        canvasRenderer.setForegroundImage(frameImage)

        clearTimeout(detectDelayTimer)
        detectDelayTimer = setTimeout(async () => {
          try {
            const convertedImage = imageDataToCanvas(currentFrame.content)
            const detected = await detectObjects(convertedImage)
            console.log('detected: ', detected)
            const detectedSportsBall = detected
              .filter(
                ({ score, label }: { score: number; label: string }) =>
                  label === 'sports ball' && score > 0.9,
              )
              .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
            if (detectedSportsBall[0]?.box) {
              console.log(
                'Highest confidence detection',
                detectedSportsBall[0].box,
                detectedSportsBall[0],
              )
              const { xmin, ymin, xmax, ymax } = detectedSportsBall[0].box
              selectionArea.update({ x: xmin, y: ymin }, { x: xmax, y: ymax })
              canvasRenderer.redraw()
            }
          } catch (e) {
            console.error('failed to convert ImageData from currentFrame.content: ', e)
          }
        }, 300)
      } catch (e) {
        console.error('failed to create imageBitMap from currentFrame.content: ', e)
      }
    }
  },
)

const getCanvasCoordinates = (action: MouseEvent) =>
  canvasRenderer.getCanvasCoordinates({ x: action.offsetX, y: action.offsetY })

const updateMouseState = (e) => {
  if (e.target == editorCanvas.value) {
    switch (e.type) {
      case 'mouseenter':
        isMouseOverCanvas = true
        break
      case 'mouseleave':
        isMouseOverCanvas = false
        break
    }
  }
}

const mouseDownOnCanvas = (action: MouseEvent) => {
  const coordinate = getCanvasCoordinates(action)

  const interactionState = canvasInteractionState.value
  const isLeftMouseButton = action.button === 0
  if ((isLeftMouseButton && (action.ctrlKey || isSpacedPressedOverCanvas)) || action.button === 1) {
    canvasInteractionState.value = {
      ...interactionState,
      isPanning: true,
    }
    const { e, f } = editorCanvas.value.getContext('2d').getTransform()
    panState.onStart({ x: e, y: f }, { x: action.clientX, y: action.clientY })
  } else {
    const { isInside, isOutside, borderSide } = selectionArea.detectRegion(coordinate)

    interactionCursor.value.resizeBorder = borderSide

    if (isInside) {
      canvasInteractionState.value = {
        ...interactionState,
        isDragging: true,
      }

      selectionArea.onStartTranslate(coordinate)
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
    } else if (isLeftMouseButton) {
      selectionArea.onStartDraw(coordinate)
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

  canvasRenderer.zoom({ x: action.offsetX, y: action.offsetY }, action.deltaY)
}

const mouseUpOnCanvas = (e) => {
  canvasInteractionState.value = {
    isDrawing: false,
    isDragging: false,
    isResizing: false,
    isPanning: false,
  }
  interactionCursor.value.resizeBorder = BorderSide.None
}

const mouseMoveOnCanvas = (action: MouseEvent) => {
  const coordinate = getCanvasCoordinates(action)

  const { isPanning, isDragging, isResizing, isDrawing, resizeSide } = canvasInteractionState.value

  const borderSide = interactionCursor.value.resizeBorder
  const isHovering = !(isDragging || isResizing || isDrawing)

  let showHover = isHovering
  let showCrosshair = isDrawing
  let showBorderResize = borderSide

  if (isPanning) {
    const currentCoordinates = { x: action.clientX, y: action.clientY }
    const { x, y } = panState.onMove(currentCoordinates)
    canvasRenderer.setCanvasOffset({ x, y })
  } else if (isDragging) {
    selectionArea.onTranslate(coordinate)
    canvasRenderer.redraw()
  } else if (isResizing) {
    selectionArea.onResize(coordinate, resizeSide)
    canvasRenderer.redraw()
  } else if (isDrawing) {
    selectionArea.onDraw(coordinate)
    canvasRenderer.redraw()
  } else {
    const {
      isInside,
      isOutside,
      borderSide: hoverBorderSide,
    } = selectionArea.detectRegion(coordinate)
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

const mouseEnterOnCanvas = (action) => {
  updateMouseState(action)
}

const mouseLeaveOnCanvas = (action) => {
  updateMouseState(action)

  const { isPanning, isResizing, isDragging, isDrawing } = canvasInteractionState.value
  if (isPanning) {
    canvasInteractionState.value.isPanning = false
  }
  // TODO Only if mouse up while off canvas
  else if (isResizing || isDragging || isDrawing) {
    mouseMoveOnCanvas(action)
    mouseUpOnCanvas(action)
  }
}

const onKeyOverCanvas = (e) => {
  if (!isMouseOverCanvas) {
    return false
  }

  switch (e.type) {
    case 'keydown':
      const keyCode = e.code
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
          canvasRenderer.redraw()
          return true

        case 'Space':
          isSpacedPressedOverCanvas = true
          return true
        case 'Comma':
        case 'Period':
          onScrubFrame(keyCode == 'Comma' ? -1 : 1)
          return true
      }
      break
  }

  return false
}

// TODO Keymapping
const onKeyEvent = (e: MouseEvent) => {
  if (onKeyOverCanvas(e)) {
    e.stopPropagation()
    e.preventDefault()
  }
  if (e.type == 'keyup' && e.code == 'Space') {
    isSpacedPressedOverCanvas = false
  }
}

const registerListeners = (isRegistering) => {
  if (isRegistering) {
    document.addEventListener('keyup', onKeyEvent)
    document.addEventListener('keydown', onKeyEvent)
  } else {
    document.removeEventListener('keyup', onKeyEvent)
    document.removeEventListener('keydown', onKeyEvent)
  }
}

onMounted(() => {
  registerListeners(true)

  const container = canvasContainer.value
  editorCanvasWidth.value = container.clientWidth
  editorCanvasHeight.value = container.clientHeight

  nextTick(() => {
    const canvas = editorCanvas.value
    if (canvas) {
      canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        return false
      })

      canvasRenderer = new CanvasRenderer(canvas, props.imageContent, [selectionArea])
      loadDetector()
      isCanvasReady.value = true
      canvasRenderer.redraw()
    }
  })
})

onUnmounted(() => {
  registerListeners(false)
})

const onScrubFrame = (delta) => {
  emit('seekFrame', { delta })
}
</script>

<template lang="pug">
div.fill-space(ref="canvasContainer")
  canvas(ref="editorCanvas"
         :width='editorCanvasWidth'
         :height='editorCanvasHeight'
         :class="{canvas: interactionCursor.crosshair, hover: interactionCursor.hovering, dragging: canvasInteractionState.isDragging, 'resize-left': interactionCursor.resizeBorder==BorderSide.Left, 'resize-right': interactionCursor.resizeBorder==BorderSide.Right, 'resize-top': interactionCursor.resizeBorder==BorderSide.Top, 'resize-bottom': interactionCursor.resizeBorder==BorderSide.Bottom, 'top-left-corner': interactionCursor.resizeBorder==BorderSide.TopLeft, 'top-right-corner': interactionCursor.resizeBorder==BorderSide.TopRight, 'bottom-left-corner': interactionCursor.resizeBorder==BorderSide.BottomLeft, 'bottom-right-corner': interactionCursor.resizeBorder==BorderSide.BottomRight}"
         @mousedown="mouseDownOnCanvas"
         @mousemove="mouseMoveOnCanvas"
         @mouseup="mouseUpOnCanvas"
         @mouseenter="mouseEnterOnCanvas"
         @mouseleave="mouseLeaveOnCanvas"
         @wheel="mouseWheelOnCanvas"
  )
</template>

<style scoped>
.fill-space {
  height: 100vh;
  width: 100vw;
}
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
