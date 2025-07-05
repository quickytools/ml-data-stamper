export interface CanvasRenderable {
  get isClippingRender(): boolean
  get willRender(): boolean
  draw(ctx: CanvasRenderingContext2D, properties: any): void
}
