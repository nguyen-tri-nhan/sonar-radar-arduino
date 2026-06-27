import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { MAX_RANGE_M, toCanvasXY } from '../utils/radarMath'
import type { RadarPoint } from '../types/radar'

const FADE_DURATION_MS = 3000
const POINT_RADIUS = 4
const TILT_LINES = [0, 15, 30, 45, 60, 75, 90]
const RANGE_RINGS = [1, 2, 3, 4]

export interface SideViewCanvasHandle {
  addPoint: (tilt: number, distanceM: number) => void
}

interface Props { size: number }

export const SideViewCanvas = forwardRef<SideViewCanvasHandle, Props>(({ size }, ref) => {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const pointsRef  = useRef<RadarPoint[]>([])
  const sweepTilt  = useRef<number | null>(null)

  useImperativeHandle(ref, () => ({
    addPoint(tilt: number, distanceM: number) {
      sweepTilt.current = tilt
      if (distanceM > 0 && distanceM <= MAX_RANGE_M) {
        pointsRef.current.push({ angle: tilt, distanceM, alpha: 1 })
        if (pointsRef.current.length > 200) pointsRef.current.shift()
      }
    },
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let lastTime = performance.now()
    let rafId: number

    function draw(now: number) {
      const dt = now - lastTime
      lastTime = now
      const w = canvas!.width, h = canvas!.height
      // Sensor at bottom-center for vertical cross-section
      const cx = w / 2
      const cy = h - 8
      const radius = h - 16

      ctx.clearRect(0, 0, w, h)
      drawSideGrid(ctx, cx, cy, radius)

      pointsRef.current = pointsRef.current.filter(p => p.alpha > 0)
      for (const p of pointsRef.current) {
        p.alpha = Math.max(0, p.alpha - dt / FADE_DURATION_MS)
        // toCanvasXY: angle=tilt, sensor origin at (cx, cy)
        const { x, y } = toCanvasXY(p.angle, p.distanceM, cx, cy, radius)
        ctx.beginPath()
        ctx.arc(x, y, POINT_RADIUS, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0,200,255,${p.alpha})`
        ctx.fill()
      }

      if (sweepTilt.current !== null) {
        const rad = (sweepTilt.current * Math.PI) / 180
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + radius * Math.cos(rad), cy - radius * Math.sin(rad))
        ctx.strokeStyle = 'rgba(0,200,255,0.8)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [size])

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        style={{ display: 'block', background: '#00001a' }}
      />
      <span style={{
        position: 'absolute', bottom: 10, left: '50%',
        transform: 'translateX(-50%)',
        fontSize: 10, color: 'rgba(0,200,255,0.5)', fontFamily: 'monospace',
      }}>
        SIDE VIEW — elevation
      </span>
    </div>
  )
})

SideViewCanvas.displayName = 'SideViewCanvas'

function drawSideGrid(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  ctx.lineWidth = 1
  ctx.font = '10px monospace'

  // Range arcs (0° to 90° = upper-right quarter circle)
  for (const m of RANGE_RINGS) {
    const r = (m / MAX_RANGE_M) * radius
    ctx.beginPath()
    ctx.arc(cx, cy, r, -Math.PI / 2, 0, false)  // 90° → 0° (top to right)
    ctx.strokeStyle = 'rgba(0,200,255,0.15)'
    ctx.stroke()
    ctx.fillStyle = 'rgba(0,200,255,0.4)'
    ctx.fillText(`${m}m`, cx + r + 2, cy - 4)
  }

  // Tilt angle lines (0° = horizontal right, 90° = straight up)
  for (const t of TILT_LINES) {
    const rad = (t * Math.PI) / 180
    const x2 = cx + radius * Math.cos(rad)
    const y2 = cy - radius * Math.sin(rad)
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(x2, y2)
    ctx.strokeStyle = 'rgba(0,200,255,0.15)'
    ctx.stroke()
    if (t % 30 === 0) {
      ctx.fillStyle = 'rgba(0,200,255,0.4)'
      ctx.fillText(`${t}°`, x2 + (t === 90 ? 4 : 2), y2 + (t === 0 ? -4 : 4))
    }
  }

  // Horizontal baseline
  ctx.beginPath()
  ctx.moveTo(cx - 10, cy)
  ctx.lineTo(cx + radius + 4, cy)
  ctx.strokeStyle = 'rgba(0,200,255,0.2)'
  ctx.stroke()

  // Sensor origin dot
  ctx.beginPath()
  ctx.arc(cx, cy, 3, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,200,255,0.8)'
  ctx.fill()
}
