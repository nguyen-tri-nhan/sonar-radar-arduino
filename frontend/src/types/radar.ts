export interface RadarReading {
  type: 'READING'
  radarId: string
  pan: number      // azimuth degrees (0-180°)
  tilt: number     // elevation degrees (0-90°)
  distance: number // cm
  timestamp: number
}

export interface RadarPoint {
  angle: number      // degrees (pan or tilt depending on canvas)
  distanceM: number  // meters
  alpha: number      // 0–1 fade
}

export type DisplayMode = '2D' | '3D' | '3D-view'
