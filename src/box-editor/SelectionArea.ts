export class SelectionArea {
  x: number = 0
  y: number = 0
  width: number = 0
  height: number = 0
  outerLayer: number = 15
  whereUserClicked: { x: number; y: number } = { x: 0, y: 0 }

  isDefined(): boolean {
    return this.width > 0 && this.height > 0
  }

  getBoundingTransform(viewXform: { a: number }): DOMMatrix {
    // TODO Center on view bounds
    const { a } = viewXform
    const inverseScale = a > 0 ? 1 / a : 1
    return new DOMMatrix([a, 0, 0, a, -this.x * a, -this.y * a])
  }

  storeUserClick(coordinate: { x: number; y: number }): void {
    this.whereUserClicked.x = coordinate.x - this.x
    this.whereUserClicked.y = coordinate.y - this.y
  }

  contains(coordinate: { x: number; y: number }): boolean {
    return (
      coordinate.x >= this.x &&
      coordinate.x <= this.x + this.width &&
      coordinate.y >= this.y &&
      coordinate.y <= this.y + this.height
    )
  }

  outerZoneDetection(coordinate: { x: number; y: number }): boolean {
    return (
      coordinate.x >= this.x - this.outerLayer &&
      coordinate.x <= this.x + this.width + this.outerLayer &&
      coordinate.y >= this.y - this.outerLayer &&
      coordinate.y <= this.y + this.height + this.outerLayer
    )
  }

  move(x: number, y: number): void {
    this.x = x - this.whereUserClicked.x
    this.y = y - this.whereUserClicked.y
  }

  checkLeftZone(coordinate: { x: number }): boolean {
    return coordinate.x >= this.x - this.outerLayer && coordinate.x <= this.x
  }

  checkRightZone(coordinate: { x: number }): boolean {
    return (
      coordinate.x >= this.x + this.width && coordinate.x <= this.x + this.width + this.outerLayer
    )
  }

  checkTopZone(coordinate: { y: number }): boolean {
    return coordinate.y <= this.y && coordinate.y >= this.y - this.outerLayer
  }

  checkBottomZone(coordinate: { y: number }): boolean {
    return (
      coordinate.y >= this.y + this.height && coordinate.y <= this.y + this.height + this.outerLayer
    )
  }
}
