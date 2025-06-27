<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'

import { BorderSide, SelectionArea } from '../box-editor/SelectionArea'

import { CanvasRenderer } from '../box-editor/CanvasRenderer'
import { CanvasInteractor } from '../box-editor/CanvasInteractor'
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

const isLoadingDetector = ref(false)
const isDetectingObjects = ref(false)

// RectangleInteractionState
const selectionInteractionState = ref({
  shape: {
    isDrawing: false,
    isDragging: false,
    isResizing: false,
  },
  resizeSide: Object, // RectangleSide
})

const interactionCursor = ref({
  resizeBorder: BorderSide.None,
  hovering: false,
  crosshair: false,
})

let canvasRenderer: CanvasRenderer
let canvasInteractor

const selectionArea = new SelectionArea()

const objectDetector = new YoloObjectDetector()
let detectDelayTimer: ReturnType<typeof window.setTimeout>

// TODO Update visuals to reflect detection state
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
  async (imageContent) => {
    const { content } = imageContent
    if (content) {
      try {
        canvasRenderer.setForegroundImage(content)

        clearTimeout(detectDelayTimer)
        detectDelayTimer = setTimeout(async () => {
          try {
            const imageCanvas = imageDataToCanvas(content)
            const detected = await detectObjects(imageCanvas)
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
            console.error('failed to convert frame to ImageData', e)
          }
        }, 300)
      } catch (e) {
        console.error('failed to create image from frame', e)
      }
    }
  },
)

const mouseDownOnCanvas = (action: MouseEvent) => {
  if (canvasInteractor) {
    const { borderSide, selectionState } = canvasInteractor.onMouseDown(action, selectionArea)
    interactionCursor.value.resizeBorder = borderSide
    selectionInteractionState.value = selectionState
  }
}

const mouseWheelOnCanvas = (e: WheelEvent) => {
  canvasInteractor?.onMouseWheel(e)
}

const mouseUpOnCanvas = (e) => {
  canvasInteractor?.onMouseUp(e)
  selectionInteractionState.value = {
    shape: {
      isDrawing: false,
      isDragging: false,
      isResizing: false,
    },
  }
  interactionCursor.value.resizeBorder = BorderSide.None
}

const mouseMoveOnCanvas = (e: MouseEvent) => {
  if (canvasInteractor) {
    const moveResult = canvasInteractor?.onMouseMove(
      e,
      selectionInteractionState.value,
      selectionArea,
      interactionCursor.value.resizeBorder,
    )
    if (moveResult) {
      const { isInsideArea, borderSide, isOutsideArea } = moveResult
      interactionCursor.value = {
        resizeBorder: borderSide,
        hovering: isInsideArea,
        crosshair: isOutsideArea,
      }
    }
  }
}

const mouseEnterOnCanvas = (e) => {
  canvasInteractor?.onMouseEnter(e)
}

const mouseLeaveOnCanvas = (e) => {
  if (canvasInteractor?.onMouseLeave(e) === false) {
    // TODO Only if mouse up while off canvas
    const { isResizing, isDragging, isDrawing } = selectionInteractionState.value.shape
    if (isResizing || isDragging || isDrawing) {
      mouseMoveOnCanvas(e)
      mouseUpOnCanvas(e)
    }
  }
}

const onKeyOverCanvas = (e) => {
  if (!canvasInteractor?.isMouseOverCanvas) {
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
          canvasInteractor.isSpacePressed = true
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
    canvasInteractor.isSpacePressed = false
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
      canvasInteractor = new CanvasInteractor(canvas, canvasRenderer)

      loadDetector()

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
         :class="{canvas: interactionCursor.crosshair, hover: interactionCursor.hovering, dragging: selectionInteractionState.shape.isDragging, 'resize-left': interactionCursor.resizeBorder==BorderSide.Left, 'resize-right': interactionCursor.resizeBorder==BorderSide.Right, 'resize-top': interactionCursor.resizeBorder==BorderSide.Top, 'resize-bottom': interactionCursor.resizeBorder==BorderSide.Bottom, 'top-left-corner': interactionCursor.resizeBorder==BorderSide.TopLeft, 'top-right-corner': interactionCursor.resizeBorder==BorderSide.TopRight, 'bottom-left-corner': interactionCursor.resizeBorder==BorderSide.BottomLeft, 'bottom-right-corner': interactionCursor.resizeBorder==BorderSide.BottomRight}"
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
../types/RectangleInteractionState
