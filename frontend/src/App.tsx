import { useCallback, useRef } from 'react'
import { RadarCanvas } from './components/RadarCanvas'
import type { RadarCanvasHandle } from './components/RadarCanvas'
import { useRadarWebSocket } from './hooks/useRadarWebSocket'
import type { RadarReading } from './types/radar'
import { cmToM } from './utils/radarMath'
import './App.css'

const CANVAS_SIZE = 600

export default function App() {
  const canvasRef = useRef<RadarCanvasHandle>(null)

  const onReading = useCallback((r: RadarReading) => {
    canvasRef.current?.addPoint(r.angle, cmToM(r.distance))
  }, [])

  const { connected } = useRadarWebSocket(onReading)

  return (
    <div className="app">
      <header className="app-header">
        <span className="title">Sonar Radar</span>
        <span className={`status ${connected ? 'online' : 'offline'}`}>
          {connected ? '● ONLINE' : '○ OFFLINE'}
        </span>
      </header>
      <main>
        <RadarCanvas ref={canvasRef} size={CANVAS_SIZE} />
      </main>
    </div>
  )
}
