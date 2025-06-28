import type { CanvasRenderer } from './CanvasRenderer'
import type { RectangleInteractionState } from '@/types/RectangleInteractionState'
import type { Coordinate2d } from '@/types/Coordinate'
import { BorderSide, SelectionArea } from './SelectionArea'

const rectangleSizeNone = {
  top: false,
  right: false,
  bottom: false,
  left: false,
}

const topBorderSides = new Set([BorderSide.Top, BorderSide.TopRight, BorderSide.TopLeft])
const rightBorderSides = new Set([BorderSide.Right, BorderSide.TopRight, BorderSide.BottomRight])
const bottomBorderSides = new Set([
  BorderSide.Bottom,
  BorderSide.BottomRight,
  BorderSide.BottomLeft,
])
const leftBorderSides = new Set([BorderSide.Left, BorderSide.TopLeft, BorderSide.BottomLeft])

export class CanvasInteractor extends EventTarget {
  private _canvasState = {
    isPanning: false,
    isMouseOver: false,
    isSpacePressedOver: false,
  }
  private get canvasState() {
    return this._canvasState
  }
  private set canvasState(value: any) {
    this._canvasState = {
      ...this._canvasState,
      ...value,
    }
    // TODO Broadcast change
  }

  get isMouseOverCanvas() {
    return this.canvasState.isMouseOver
  }

  set isSpacePressed(value: boolean) {
    this._canvasState.isSpacePressedOver = value
  }

  private panState = {
    zeroCoordinate: { x: 0, y: 0 },
    startPanCoordinate: { x: 0, y: 0 },
    onStart: function (zeroCoordinate: Coordinate2d, startPanCoordinate: Coordinate2d) {
      this.zeroCoordinate = zeroCoordinate
      this.startPanCoordinate = startPanCoordinate
    },
    onMove: function (currentPanCoordinate: Coordinate2d) {
      const { x: zx, y: zy } = this.zeroCoordinate
      const { x: sx, y: sy } = this.startPanCoordinate
      const { x, y } = currentPanCoordinate
      return {
        x: zx + x - sx,
        y: zy + y - sy,
      }
    },
  }

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly canvasRenderer: CanvasRenderer,
  ) {
    super()
  }

  getCanvasCoordinates(e: MouseEvent) {
    return this.canvasRenderer.getCanvasCoordinates({ x: e.offsetX, y: e.offsetY })
  }

  private isTargetingCanvas(e: MouseEvent | WheelEvent) {
    return e.target == this.canvas
  }

  onMouseDown(
    e: MouseEvent,
    selectionArea: SelectionArea,
  ): { borderSide: BorderSide; selectionState: RectangleInteractionState } {
    const result = {
      borderSide: BorderSide.None,
      selectionState: {
        shape: {
          isDrawing: false,
          isDragging: false,
          isResizing: false,
        },
        resizeSide: rectangleSizeNone,
      },
    }

    if (!this.isTargetingCanvas(e)) {
      return result
    }

    const coordinate = this.getCanvasCoordinates(e)

    const canvasState = this.canvasState

    const isLeftMouseButton = e.button === 0
    if ((isLeftMouseButton && (e.ctrlKey || canvasState.isSpacePressedOver)) || e.button === 1) {
      this.canvasState = {
        isPanning: true,
      }

      const { e: xformX, f: xformY } = this.canvas.getContext('2d')!.getTransform()
      this.panState.onStart({ x: xformX, y: xformY }, { x: e.clientX, y: e.clientY })
    } else if (isLeftMouseButton) {
      const { isInside, borderSide } = selectionArea.detectRegion(coordinate)

      result.borderSide = borderSide

      if (isInside) {
        selectionArea.onStartTranslate(coordinate)

        result.selectionState.shape.isDragging = true
      } else if (borderSide != BorderSide.None) {
        result.selectionState.shape.isResizing = true
        result.selectionState.resizeSide = {
          top: topBorderSides.has(borderSide),
          right: rightBorderSides.has(borderSide),
          bottom: bottomBorderSides.has(borderSide),
          left: leftBorderSides.has(borderSide),
        }
      } else {
        selectionArea.onStartDraw(coordinate)

        result.selectionState.shape.isDrawing = true
      }
    }

    return result
  }

  onMouseWheel(e: WheelEvent) {
    if (!this.isTargetingCanvas(e)) {
      return
    }

    if (this.canvasState.isPanning) {
      return
    }

    e.preventDefault()

    this.canvasRenderer.zoom({ x: e.offsetX, y: e.offsetY }, e.deltaY)
  }

  onMouseUp(e: MouseEvent) {
    if (!this.isTargetingCanvas(e)) {
      return
    }

    this.canvasState = {
      isPanning: false,
    }
  }

  onMouseMove(
    e: MouseEvent,
    selectionState: RectangleInteractionState,
    selectionArea: SelectionArea,
    resizeBorderSide: BorderSide,
  ): {
    isInsideArea: boolean
    borderSide: BorderSide
    isOutsideArea: boolean
  } | null {
    if (!this.isTargetingCanvas(e)) {
      return null
    }

    const coordinate = this.getCanvasCoordinates(e)

    const { isPanning } = this.canvasState
    const {
      shape: { isDragging, isResizing, isDrawing },
      resizeSide,
    } = selectionState

    // const borderSide = interactionCursor.value.resizeBorder
    const isHovering = !(isDragging || isResizing || isDrawing)

    let isSelectShape = isHovering
    let isDrawShape = isDrawing
    let borderBelow = resizeBorderSide

    if (isPanning) {
      const currentCoordinates = { x: e.clientX, y: e.clientY }
      const { x, y } = this.panState.onMove(currentCoordinates)
      this.canvasRenderer.setCanvasOffset({ x, y })
    } else if (isDragging) {
      selectionArea.onTranslate(coordinate)
      this.canvasRenderer.redraw()
    } else if (isResizing) {
      selectionArea.onResize(coordinate, resizeSide)
      this.canvasRenderer.redraw()
    } else if (isDrawing) {
      selectionArea.onDraw(coordinate)
      this.canvasRenderer.redraw()
    } else {
      const { isInside, isOutside, borderSide } = selectionArea.detectRegion(coordinate)
      borderBelow = borderSide
      isDrawShape = isOutside
      isSelectShape = isInside
    }

    return {
      isInsideArea: isSelectShape,
      borderSide: borderBelow,
      isOutsideArea: isDrawShape,
    }
  }

  private updateMouseState(e: MouseEvent) {
    switch (e.type) {
      case 'mouseenter':
        this.canvasState = { isMouseOver: true }
        break
      case 'mouseleave':
        this.canvasState = { isMouseOver: false }
        break
    }
  }

  onMouseEnter(e: MouseEvent) {
    if (!this.isTargetingCanvas(e)) {
      return
    }

    this.updateMouseState(e)
  }

  onMouseLeave(e: MouseEvent): boolean {
    if (!this.isTargetingCanvas(e)) {
      return false
    }

    this.updateMouseState(e)

    if (this.canvasState.isPanning) {
      this.canvasState = { isPanning: false }
      return true
    }

    return false
  }
}
