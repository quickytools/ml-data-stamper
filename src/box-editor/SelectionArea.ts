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

export class SelectionArea {
  x: number = 0
  y: number = 0
  width: number = 0
  height: number = 0

  private _borderSize = 0
  get borderSize() {
    return this._borderSize
  }
  private set borderSize(value) {
    this._borderSize = Math.max(value, 1)
  }

  get xMin() {
    return this.x
  }

  get xMax() {
    return this.x + this.width
  }

  get yMin() {
    return this.y
  }

  get yMax() {
    return this.y + this.height
  }

  get horizontalBorderMin() {
    return this.xMin - this.borderSize
  }

  get horizontalBorderMax() {
    return this.xMax + this.borderSize
  }

  get verticalBorderMin() {
    return this.yMin - this.borderSize
  }

  get verticalBorderMax() {
    return this.yMax + this.borderSize
  }

  get isDefined() {
    return this.width > 0 && this.height > 0
  }

  whereUserClicked: { x: number; y: number } = { x: 0, y: 0 }

  constructor(borderSize = 15) {
    this.borderSize = borderSize
  }

  getBoundingTransform(viewXform: { a: number }): DOMMatrix {
    // TODO Center on view bounds
    const { a } = viewXform
    return new DOMMatrix([a, 0, 0, a, -this.x * a, -this.y * a])
  }

  storeUserClick(coordinate: { x: number; y: number }): void {
    this.whereUserClicked.x = coordinate.x - this.x
    this.whereUserClicked.y = coordinate.y - this.y
  }

  contains(coordinate: { x: number; y: number }): boolean {
    const { x, y } = coordinate
    return x >= this.x && x <= this.x + this.width && y >= this.y && y <= this.y + this.height
  }

  private getBorderSide(sideQualifiers: {
    isLeft: boolean
    isRight: boolean
    isTop: boolean
    isBottom: boolean
  }): BorderSide {
    const { isLeft, isRight, isTop, isBottom } = sideQualifiers
    if (isLeft) {
      if (isTop) {
        return BorderSide.TopLeft
      } else if (isBottom) {
        return BorderSide.BottomLeft
      } else {
        return BorderSide.Left
      }
    } else if (isRight) {
      if (isTop) {
        return BorderSide.TopRight
      } else if (isBottom) {
        return BorderSide.BottomRight
      } else {
        return BorderSide.Right
      }
    } else if (isTop) {
      return BorderSide.Top
    } else if (isBottom) {
      return BorderSide.Bottom
    }
    return BorderSide.None
  }

  detectRegion(coordinate: { x: number; y: number }): AreaRegion {
    let isInside = false
    let isOutside = false
    let borderSide = BorderSide.None

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

    const isLeft = this.horizontalBorderMin < x && x < this.xMin
    const isRight = this.xMax < x && x < this.horizontalBorderMax
    const isTop = this.verticalBorderMin < y && y < this.y
    const isBottom = this.yMax < y && y < this.verticalBorderMax
    return {
      isInside,
      isOutside,
      borderSide: this.getBorderSide({ isLeft, isRight, isTop, isBottom }),
    }
  }

  move(x: number, y: number): void {
    this.x = x - this.whereUserClicked.x
    this.y = y - this.whereUserClicked.y
  }
}
