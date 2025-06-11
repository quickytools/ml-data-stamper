import { ref, toRaw } from 'vue'
import { SelectionArea } from '../box-editor/SelectionArea'

export class CanvasRenderer {
  private currentFrame = ref()
  private editorCanvas = ref()
  private editorScale = ref()
  private interactionCursor = ref()

  private panState
  private selectionArea = new SelectionArea()

  constructor(
    editorCanvas: HTMLCanvasElement,
    currentFrame: null,
    editorScale: number,
    panState,
    selectionArea: SelectionArea,
    interactionCursor: object,
  ) {
    this.editorCanvas.value = editorCanvas
    this.currentFrame.value = currentFrame
    this.editorScale.value = editorScale
    this.panState = panState
    this.selectionArea = selectionArea
    this.interactionCursor.value = interactionCursor
  }

  private drawCheckerboard(canvas, { startX, startY, width, height, lightColor, darkColor }) {
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

  canvasBackground = () => {
    const canvas = this.editorCanvas.value
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

    this.drawCheckerboard(canvas, {
      startX,
      startY,
      width: scaledWidth,
      height: scaledHeight,
      lightColor: 'rgba(255, 255, 255, 0.80)',
      darkColor: 'rgba(0, 0, 0, 0.05)',
    })
    if (this.currentFrame.value != null) {
      ctx.drawImage(this.currentFrame.value, 0, 0)
    }
  }

  setVideoFrame = async (videoFrame: any) => {
    const rawContent = toRaw(videoFrame)
    try {
      this.currentFrame.value = await createImageBitmap(rawContent)
    } catch (e) {
      console.error('failed to create imageBitMap from frame.content: ', e)
    }
  }

  zoom = (mouseCoordinate: { x: number; y: number }, deltaY: number) => {
    const canvas = this.editorCanvas.value
    const ctx = canvas.getContext('2d')

    const xform = ctx.getTransform()

    const prevScale = xform.a

    let newScale = prevScale + deltaY * -0.01 // Adjust the zoom speed as needed
    newScale = Math.min(Math.max(0.3, newScale), 10)

    const scaleChange = newScale / prevScale

    const { x, y } = mouseCoordinate
    const updatedXform = new DOMMatrix()
      .translate(x, y)
      .scale(scaleChange)
      .translate(-x, -y)
      .multiply(xform)

    this.editorScale = newScale

    ctx.setTransform(updatedXform)

    this.canvasBackground() // redraws the background
    this.paintIt(this.selectionArea)
  }

  moveCanvasView = (action: MouseEvent) => {
    const currentCoordinates = { x: action.clientX, y: action.clientY }
    const { x, y } = this.panState.onMove(currentCoordinates)
    const ctx = this.editorCanvas.value.getContext('2d')
    const { a } = ctx.getTransform()
    ctx.setTransform(a, 0, 0, a, x, y)

    this.canvasBackground()
    this.paintIt(this.selectionArea)
  }

  drawOnCanvas = (x1: number, y1: number, x2: number, y2: number) => {
    const canvas = this.editorCanvas.value
    const ctx = canvas.getContext('2d')

    this.canvasBackground()
    this.interactionCursor.value.crosshair = true

    const startX = Math.min(x1, x2)
    const startY = Math.min(y1, y2)
    const width = Math.abs(x2 - x1)
    const height = Math.abs(y2 - y1)

    this.selectionArea.x = startX
    this.selectionArea.y = startY
    this.selectionArea.width = width
    this.selectionArea.height = height

    this.paintIt(this.selectionArea)
  }

  // function to move the rectangle
  movingRectangle = (x: number, y: number) => {
    const Canvas = this.editorCanvas.value
    const ctx = Canvas.getContext('2d')

    this.canvasBackground()

    this.selectionArea.move(x, y)

    this.paintIt(this.selectionArea)
  }

  // model function to resize the rectangle
  resizingRectangle = (x: number, y: number) => {
    const canvas = this.editorCanvas.value
    const ctx = canvas.getContext('2d')

    this.canvasBackground()

    // Handle each side resizing
    if (this.interactionCursor.value.sizingDirection.left) {
      const newWidth = this.selectionArea.x + this.selectionArea.width - x
      if (newWidth >= this.selectionArea.borderSize) {
        this.selectionArea.x = x
        this.selectionArea.width = newWidth
      }
    }
    if (this.interactionCursor.value.sizingDirection.right) {
      const newWidth = x - this.selectionArea.x
      if (newWidth >= this.selectionArea.borderSize) {
        this.selectionArea.width = newWidth
      }
    }
    if (this.interactionCursor.value.sizingDirection.top) {
      const newHeight = this.selectionArea.y + this.selectionArea.height - y
      if (newHeight >= this.selectionArea.borderSize) {
        this.selectionArea.y = y
        this.selectionArea.height = newHeight
      }
    }
    if (this.interactionCursor.value.sizingDirection.bottom) {
      const newHeight = y - this.selectionArea.y
      if (newHeight >= this.selectionArea.borderSize) {
        this.selectionArea.height = newHeight
      }
    }

    this.paintIt(this.selectionArea)
  }

  // view function for user to see the rectangle
  paintIt = (area: { x: number; y: number; width: number; height: number }) => {
    const canvas = this.editorCanvas.value
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.fillStyle = 'rgba(255, 0, 0, 0.05)'
    ctx.fillRect(area.x, area.y, area.width, area.height)
  }

  getMousePositionOnCanvas(action: MouseEvent) {
    const canvas = this.editorCanvas.value
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
}
