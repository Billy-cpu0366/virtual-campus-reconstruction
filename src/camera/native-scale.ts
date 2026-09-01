// nativeScale 换算（FACT：运行时设备像素比，外部注入，非写死参数）。

export function blurStrength(nativeScale: number): number {
  return 16 * nativeScale; // blur = 16 * nativeScale
}

export function scaleFactor(nativeScale: number): number {
  return 1 / nativeScale; // scaleFactor = 1 / nativeScale
}

export function chunkRenderBlockSize(nativeScale: number): number {
  return Math.ceil(10 * nativeScale); // chunk 渲染分块 = ceil(10 * nativeScale)
}
