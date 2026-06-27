export interface RadarReading {
  type: 'READING'
  radarId: string
  angle: number    // degrees
  distance: number // cm
  timestamp: number
}

export interface RadarPoint {
  angle: number      // degrees
  distanceM: number  // meters (converted from cm)
  alpha: number      // 0–1, for fade effect
}
