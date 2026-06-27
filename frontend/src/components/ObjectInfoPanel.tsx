import type { RadarReading } from '../types/radar'
import { cmToM, to3DCoords } from '../utils/radarMath'

interface Props {
  reading: RadarReading | null
}

export function ObjectInfoPanel({ reading }: Props) {
  if (!reading || reading.distance === 0) {
    return (
      <div className="object-panel empty">
        <span>No object detected</span>
      </div>
    )
  }

  const dm = cmToM(reading.distance)
  const { x, y, z } = to3DCoords(reading.pan, reading.tilt, dm)

  return (
    <div className="object-panel">
      <div className="object-panel-row">
        <span className="label">Pan</span>
        <span className="value">{reading.pan}°</span>
        <span className="label">Tilt</span>
        <span className="value">{reading.tilt}°</span>
        <span className="label">Dist</span>
        <span className="value">{dm.toFixed(2)} m</span>
      </div>
      <div className="object-panel-row">
        <span className="label">X</span>
        <span className="value">{x >= 0 ? '+' : ''}{x.toFixed(2)} m</span>
        <span className="label">Y</span>
        <span className="value">{y >= 0 ? '+' : ''}{y.toFixed(2)} m</span>
        <span className="label">Z</span>
        <span className="value">{z >= 0 ? '+' : ''}{z.toFixed(2)} m</span>
      </div>
    </div>
  )
}
