import type { CanvasRenderable } from '@/types/CanvasRenderable'
import type { RectangleSide } from '@/types/RectangleInteractionState'
import type { Coordinate2d } from '@/types/Coordinate'
import type { RectangleShape } from '@/types/RectangleShape'

export enum BorderSide {
  None = 0,
  Top,
  TopRight,
  Right,
  BottomRight,
  Bottom,
  BottomLeft,
  Left,
  TopLeft,
}

export type AreaRegion = {
  isInside: boolean
  isOutside: boolean
  borderSide: BorderSide
}

export class SelectionArea implements CanvasRenderable {
  private x = 0
  private y = 0
  private width = 0
  private height = 0

  private _borderSize = 0
  private get borderSize() {
    return this._borderSize
  }
  private set borderSize(value) {
    this._borderSize = Math.max(value, 1)
  }

  get shape(): RectangleShape {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
    }
  }

  private get xMin() {
    return this.x
  }

  private get xMax() {
    return this.x + this.width
  }

  private get yMin() {
    return this.y
  }

  private get yMax() {
    return this.y + this.height
  }

  private get horizontalBorderMin() {
    return this.xMin - this.borderSize
  }

  private get horizontalBorderMax() {
    return this.xMax + this.borderSize
  }

  private get verticalBorderMin() {
    return this.yMin - this.borderSize
  }

  private get verticalBorderMax() {
    return this.yMax + this.borderSize
  }

  get isDefined() {
    return this.width > 0 && this.height > 0
  }

  private drawCoordinate: Coordinate2d = { x: 0, y: 0 }
  private translateOffset: Coordinate2d = { x: 0, y: 0 }

  constructor(borderSize = 15) {
    this.borderSize = borderSize
  }

  getBoundingTransform(viewXform: { a: number }): DOMMatrix {
    // TODO Center on view bounds
    const { a } = viewXform
    return new DOMMatrix([a, 0, 0, a, -this.x * a, -this.y * a])
  }

  contains(coordinate: Coordinate2d): boolean {
    const { x, y } = coordinate
    return x >= this.xMin && x <= this.xMax && y >= this.yMin && y <= this.yMax
  }

  private getBorderSide(sideQualifiers: RectangleSide): BorderSide {
    const { left, right, top, bottom } = sideQualifiers
    if (left) {
      if (top) {
        return BorderSide.TopLeft
      } else if (bottom) {
        return BorderSide.BottomLeft
      } else {
        return BorderSide.Left
      }
    } else if (right) {
      if (top) {
        return BorderSide.TopRight
      } else if (bottom) {
        return BorderSide.BottomRight
      } else {
        return BorderSide.Right
      }
    } else if (top) {
      return BorderSide.Top
    } else if (bottom) {
      return BorderSide.Bottom
    }
    return BorderSide.None
  }

  detectRegion(coordinate: Coordinate2d): AreaRegion {
    const isInside = false
    const isOutside = false
    const borderSide = BorderSide.None

    const { x, y } = coordinate
    if (
      !this.isDefined ||
      x < this.horizontalBorderMin ||
      x > this.horizontalBorderMax ||
      y < this.verticalBorderMin ||
      y > this.verticalBorderMax
    ) {
      return {
        isInside,
        isOutside: true,
        borderSide,
      }
    }

    if (this.contains(coordinate)) {
      return {
        isInside: true,
        isOutside,
        borderSide,
      }
    }

    const left = this.horizontalBorderMin < x && x < this.xMin
    const right = this.xMax < x && x < this.horizontalBorderMax
    const top = this.verticalBorderMin < y && y < this.y
    const bottom = this.yMax < y && y < this.verticalBorderMax
    return {
      isInside,
      isOutside,
      borderSide: this.getBorderSide({ left, right, top, bottom }),
    }
  }

  onStartDraw(coordinate: Coordinate2d) {
    this.drawCoordinate = coordinate
  }

  onDraw(coordinate: Coordinate2d) {
    const { x, y } = coordinate
    const { x: xStart, y: yStart } = this.drawCoordinate

    this.x = Math.min(x, xStart)
    this.y = Math.min(y, yStart)
    this.width = Math.abs(xStart - x)
    this.height = Math.abs(yStart - y)
  }

  update(min: Coordinate2d, max: Coordinate2d) {
    this.onStartDraw(min)
    this.onDraw(max)
  }

  onStartTranslate(coordinate: Coordinate2d) {
    this.translateOffset.x = this.x - coordinate.x
    this.translateOffset.y = this.y - coordinate.y
  }

  onTranslate(coordinate: Coordinate2d) {
    this.x = coordinate.x + this.translateOffset.x
    this.y = coordinate.y + this.translateOffset.y
  }

  onResize = (coordinate: Coordinate2d, isResizing: RectangleSide) => {
    const { x, y } = coordinate

    const { top, right, bottom, left } = isResizing

    // TODO Allow resize across opposite side(s) pinning side(s) not being dragged
    const minSize = 0

    if (left) {
      const newWidth = this.xMax - x
      if (newWidth >= minSize) {
        this.x = x
        this.width = newWidth
      }
    }

    if (right) {
      const newWidth = x - this.xMin
      if (newWidth >= minSize) {
        this.width = newWidth
      }
    }

    if (top) {
      const newHeight = this.yMax - y
      if (newHeight >= minSize) {
        this.y = y
        this.height = newHeight
      }
    }

    if (bottom) {
      const newHeight = y - this.yMin
      if (newHeight >= minSize) {
        this.height = newHeight
      }
    }
  }

  // CanvasRenderable

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath()
    ctx.fillStyle = 'rgba(255, 0, 0, 0.05)'
    ctx.fillRect(this.x, this.y, this.width, this.height)
  }
}
