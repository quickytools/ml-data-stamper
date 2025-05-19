export interface ObjectDetector {
  load(key: string): Promise<void>
  detect(imageData: string | HTMLCanvasElement): Promise<Array<any>>
}
