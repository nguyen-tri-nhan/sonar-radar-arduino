export const MAX_RANGE_M = 4

export function cmToM(cm: number): number {
  return cm / 100
}

export function toCanvasXY(
  angleDeg: number,
  distanceM: number,
  cx: number,
  cy: number,
  canvasRadius: number,
  maxRangeM = MAX_RANGE_M,
): { x: number; y: number } {
  const scale = canvasRadius / maxRangeM
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: cx + distanceM * scale * Math.cos(rad),
    y: cy - distanceM * scale * Math.sin(rad),
  }
}
