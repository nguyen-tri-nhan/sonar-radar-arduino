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

export interface Coords3D { x: number; y: number; z: number }

export function to3DCoords(panDeg: number, tiltDeg: number, distanceM: number): Coords3D {
  const panRad  = (panDeg  * Math.PI) / 180
  const tiltRad = (tiltDeg * Math.PI) / 180
  return {
    x: distanceM * Math.cos(tiltRad) * Math.cos(panRad),
    y: distanceM * Math.cos(tiltRad) * Math.sin(panRad),
    z: distanceM * Math.sin(tiltRad),
  }
}
