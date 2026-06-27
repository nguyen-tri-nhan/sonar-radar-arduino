import { useCallback, useRef, useState } from 'react'
import { RadarCanvas } from './components/RadarCanvas'
import type { RadarCanvasHandle } from './components/RadarCanvas'
import { SideViewCanvas } from './components/SideViewCanvas'
import type { SideViewCanvasHandle } from './components/SideViewCanvas'
import { Radar3DView } from './components/Radar3DView'
import type { Radar3DViewHandle } from './components/Radar3DView'
import { ObjectInfoPanel } from './components/ObjectInfoPanel'
import { useRadarWebSocket } from './hooks/useRadarWebSocket'
import type { DisplayMode, RadarReading } from './types/radar'
import { cmToM } from './utils/radarMath'
import './App.css'

const CANVAS_2D = 580
const CANVAS_3D = 420

export default function App() {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('2D')
  const [lastReading, setLastReading] = useState<RadarReading | null>(null)
  const lastUpdateMs = useRef(0)

  const topRef    = useRef<RadarCanvasHandle>(null)
  const sideRef   = useRef<SideViewCanvasHandle>(null)
  const view3DRef = useRef<Radar3DViewHandle>(null)

  const onReading = useCallback((r: RadarReading) => {
    const dm = cmToM(r.distance)
    topRef.current?.addPoint(r.pan, dm)
    sideRef.current?.addPoint(r.tilt, dm)
    view3DRef.current?.addPoint(r.pan, r.tilt, dm)

    const now = Date.now()
    if (r.distance > 0 && now - lastUpdateMs.current > 200) {
      lastUpdateMs.current = now
      setLastReading(r)
    }
  }, [])

  const { connected } = useRadarWebSocket(onReading)
  const canvasSize = displayMode === '2D' ? CANVAS_2D : CANVAS_3D

  return (
    <div className="app">
      <header className="app-header">
        <span className="title">Sonar Radar</span>
        <span className={`status ${connected ? 'online' : 'offline'}`}>
          {connected ? '● ONLINE' : '○ OFFLINE'}
        </span>
        <select
          className="mode-select"
          value={displayMode}
          onChange={e => setDisplayMode(e.target.value as DisplayMode)}
        >
          <option value="2D">2D — Top View</option>
          <option value="3D">3D — Top + Side</option>
          <option value="3D-view">3D — Immersive</option>
        </select>
      </header>

      {displayMode === '3D-view' ? (
        <Radar3DView ref={view3DRef} />
      ) : (
        <main className={`canvas-area ${displayMode === '3D' ? 'mode-3d' : 'mode-2d'}`}>
          <div className="canvas-wrap">
            <div className="canvas-label">TOP VIEW — azimuth</div>
            <RadarCanvas ref={topRef} size={canvasSize} />
          </div>

          {displayMode === '3D' && (
            <div className="canvas-wrap">
              <SideViewCanvas ref={sideRef} size={canvasSize} />
            </div>
          )}
        </main>
      )}

      {(displayMode === '3D' || displayMode === '3D-view') && (
        <ObjectInfoPanel reading={lastReading} />
      )}
    </div>
  )
}
