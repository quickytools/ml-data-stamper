import { SelectionArea } from '../box-editor/SelectionArea'

export class CanvasRenderer {
  private imageForeground: ImageBitmap | null
  private editorCanvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  private selectionArea = new SelectionArea()

  constructor(
    editorCanvas: HTMLCanvasElement,
    imageForeground: ImageBitmap | null,
    selectionArea: SelectionArea,
  ) {
    this.editorCanvas = editorCanvas
    this.ctx = editorCanvas.getContext('2d')!
    this.imageForeground = imageForeground
    this.selectionArea = selectionArea
  }

  private drawCheckerboard({ startX, startY, width, height, lightColor, darkColor }) {
    const ctx = this.ctx
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
    const canvas = this.editorCanvas
    const { a, e, f } = this.ctx.getTransform()

    const inverseScale = a > 0 ? 1 / a : 1
    const canvasWidth = canvas.width
    const canvasHeight = canvas.height
    const scaledHeight = canvasHeight * inverseScale
    const scaledWidth = canvasWidth * inverseScale
    const startX = -e * inverseScale
    const startY = -f * inverseScale

    this.ctx.clearRect(startX, startY, scaledWidth, scaledHeight)

    this.drawCheckerboard({
      startX,
      startY,
      width: scaledWidth,
      height: scaledHeight,
      lightColor: 'rgba(255, 255, 255, 0.80)',
      darkColor: 'rgba(0, 0, 0, 0.05)',
    })
    if (this.imageForeground != null) {
      this.ctx.drawImage(this.imageForeground, 0, 0)
    }
  }

  setVideoFrame = async (bitImage: ImageBitmap) => {
    this.imageForeground = bitImage
  }

  zoom = (mouseCoordinate: { x: number; y: number }, deltaY: number) => {
    const ctx = this.ctx

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

    ctx.setTransform(updatedXform)

    this.canvasBackground() // redraws the background
    this.drawRect(this.selectionArea)
  }

  panCanvasView = (coordinate: { x: number; y: number }) => {
    const { a } = this.ctx.getTransform()
    this.ctx.setTransform(a, 0, 0, a, coordinate.x, coordinate.y)

    this.canvasBackground()
    this.drawRect(this.selectionArea)
  }

  drawOnCanvas = (x1: number, y1: number, x2: number, y2: number) => {
    this.canvasBackground()

    const startX = Math.min(x1, x2)
    const startY = Math.min(y1, y2)
    const width = Math.abs(x2 - x1)
    const height = Math.abs(y2 - y1)

    this.selectionArea.x = startX
    this.selectionArea.y = startY
    this.selectionArea.width = width
    this.selectionArea.height = height

    this.drawRect(this.selectionArea)
  }

  // function to move the rectangle
  updateSelectionPosition = (x: number, y: number) => {
    this.canvasBackground()

    this.selectionArea.move(x, y)

    this.drawRect(this.selectionArea)
  }

  resizeSelectionArea = (
    coordinate: { x: number; y: number },
    isResizing: {
      isTop: boolean
      isRight: boolean
      isBottom: boolean
      isLeft: boolean
    },
  ) => {
    const { x, y } = coordinate

    this.canvasBackground()

    const { isTop, isRight, isBottom, isLeft } = isResizing
    if (isLeft) {
      const newWidth = this.selectionArea.x + this.selectionArea.width - x
      if (newWidth >= this.selectionArea.borderSize) {
        this.selectionArea.x = x
        this.selectionArea.width = newWidth
      }
    }
    if (isRight) {
      const newWidth = x - this.selectionArea.x
      if (newWidth >= this.selectionArea.borderSize) {
        this.selectionArea.width = newWidth
      }
    }
    if (isTop) {
      const newHeight = this.selectionArea.y + this.selectionArea.height - y
      if (newHeight >= this.selectionArea.borderSize) {
        this.selectionArea.y = y
        this.selectionArea.height = newHeight
      }
    }
    if (isBottom) {
      const newHeight = y - this.selectionArea.y
      if (newHeight >= this.selectionArea.borderSize) {
        this.selectionArea.height = newHeight
      }
    }

    this.drawRect(this.selectionArea)
  }

  drawRect = (rectangle: { x: number; y: number; width: number; height: number }) => {
    const ctx = this.ctx
    ctx.beginPath()
    ctx.fillStyle = 'rgba(255, 0, 0, 0.05)'
    ctx.fillRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height)
  }

  getCanvasCoordinates(viewCoordinates: { x: number; y: number }) {
    const ctx = this.ctx

    const { x, y } = viewCoordinates

    const transform = ctx.getTransform()
    const transformedPoint = new DOMPoint(x, y).matrixTransform(transform.inverse())

    return {
      x: transformedPoint.x,
      y: transformedPoint.y,
    }
  }
}
