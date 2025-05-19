export type VideoFile = {
  fileName: string
  sizeBytes: number
  signature: string
  frameCount: number
  frameRate: number
  orientationDegrees: number
}

export interface VideoLoader {
  // TODO Specify return type
  load(file: File): Promise<any>
}
