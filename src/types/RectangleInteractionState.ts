import type { ShapeInteractionState } from './ShapeInteractionState'

export type RectangleSide = {
  top: boolean
  right: boolean
  bottom: boolean
  left: boolean
}

export type RectangleInteractionState = {
  shape: ShapeInteractionState
  resizeSide: RectangleSide
}
