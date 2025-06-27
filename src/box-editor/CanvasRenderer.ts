import type { CanvasRenderable } from './CanvasRenderable'

export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D

  private isDirty = false

  constructor(
    private readonly editorCanvas: HTMLCanvasElement,
    private foregroundImage: ImageBitmap | null,
    private readonly renderables: Array<CanvasRenderable> = [],
  ) {
    this.ctx = editorCanvas.getContext('2d')!
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

  redraw() {
    this.isDirty = true
    window.requestAnimationFrame(() => {
      this.redrawDirty()
    })
  }

  private redrawDirty() {
    if (this.isDirty) {
      this.isDirty = false
      this.redrawAll()
    }
  }

  private redrawAll = () => {
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

    if (this.foregroundImage) {
      this.ctx.drawImage(this.foregroundImage, 0, 0)
    }

    // TODO Order of operations
    for (const renderable of this.renderables) {
      renderable.draw(this.ctx)
    }
  }

  setForegroundImage = async (image: ImageBitmap) => {
    this.foregroundImage = image
    this.redraw()
  }

  zoom = (mouseCoordinate: { x: number; y: number }, deltaY: number) => {
    const ctx = this.ctx

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

    ctx.setTransform(updatedXform)

    this.redraw()
  }

  setCanvasOffset = (coordinate: { x: number; y: number }) => {
    const { a } = this.ctx.getTransform()
    this.ctx.setTransform(a, 0, 0, a, coordinate.x, coordinate.y)

    this.redraw()
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
