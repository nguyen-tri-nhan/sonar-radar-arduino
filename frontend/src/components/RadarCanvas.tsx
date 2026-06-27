import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { MAX_RANGE_M, toCanvasXY } from '../utils/radarMath'
import type { RadarPoint } from '../types/radar'

const FADE_DURATION_MS = 3000
const POINT_RADIUS     = 4
const RANGE_RINGS      = [1, 2, 3, 4]
// Pan servo: 0° (right) → 90° (up/forward) → 180° (left)
const PAN_LINES        = [0, 30, 60, 90, 120, 150, 180]

export interface RadarCanvasHandle {
  addPoint: (pan: number, distanceM: number) => void
}

interface Props { size: number }

export const RadarCanvas = forwardRef<RadarCanvasHandle, Props>(({ size }, ref) => {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const pointsRef  = useRef<RadarPoint[]>([])
  const sweepAngle = useRef<number | null>(null)

  useImperativeHandle(ref, () => ({
    addPoint(pan: number, distanceM: number) {
      sweepAngle.current = pan
      if (distanceM > 0 && distanceM <= MAX_RANGE_M) {
        pointsRef.current.push({ angle: pan, distanceM, alpha: 1 })
        if (pointsRef.current.length > 500) pointsRef.current.shift()
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
      const w = canvas!.width
      const h = canvas!.height
      // Sensor at bottom-center; semicircle fills the upper portion
      const cx     = w / 2
      const cy     = h - 10
      const radius = cx - 10  // fits within canvas width with 10px margin each side

      ctx.clearRect(0, 0, w, h)
      drawSemiGrid(ctx, cx, cy, radius)

      pointsRef.current = pointsRef.current.filter(p => p.alpha > 0)
      for (const p of pointsRef.current) {
        p.alpha = Math.max(0, p.alpha - dt / FADE_DURATION_MS)
        const { x, y } = toCanvasXY(p.angle, p.distanceM, cx, cy, radius)
        ctx.beginPath()
        ctx.arc(x, y, POINT_RADIUS, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0,255,70,${p.alpha})`
        ctx.fill()
      }

      if (sweepAngle.current !== null) {
        const rad = (sweepAngle.current * Math.PI) / 180
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + radius * Math.cos(rad), cy - radius * Math.sin(rad))
        ctx.strokeStyle = 'rgba(0,255,70,0.8)'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [size])

  // Canvas is a landscape half-circle display (width × ~height/2)
  const canvasH = Math.floor(size / 2) + 30

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={canvasH}
      style={{ display: 'block', background: '#001a00' }}
    />
  )
})

RadarCanvas.displayName = 'RadarCanvas'

function drawSemiGrid(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
) {
  ctx.lineWidth = 1
  ctx.font = '10px monospace'

  // Range arcs — upper semicircle (π → 0, counterclockwise = through visual top)
  for (const m of RANGE_RINGS) {
    const r = (m / MAX_RANGE_M) * radius
    ctx.beginPath()
    ctx.arc(cx, cy, r, Math.PI, 0, true)
    ctx.strokeStyle = 'rgba(0,255,70,0.2)'
    ctx.stroke()
    // Range label above the 90° (top) point
    ctx.fillStyle = 'rgba(0,255,70,0.45)'
    ctx.fillText(`${m}m`, cx + 3, cy - r + 12)
  }

  // Pan angle lines (0° = right, 90° = up, 180° = left)
  for (const a of PAN_LINES) {
    const rad = (a * Math.PI) / 180
    const x2  = cx + radius * Math.cos(rad)
    const y2  = cy - radius * Math.sin(rad)
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(x2, y2)
    ctx.strokeStyle = 'rgba(0,255,70,0.15)'
    ctx.stroke()

    // Angle labels: place just beyond the arc end
    if (a % 30 === 0) {
      ctx.fillStyle = 'rgba(0,255,70,0.4)'
      const lx = cx + (radius + 14) * Math.cos(rad)
      const ly = cy - (radius + 14) * Math.sin(rad)
      // Clamp label within canvas bounds
      const tx = Math.max(4, Math.min(cx * 2 - 28, lx - 10))
      const ty = Math.max(12, Math.min(cy + 2, ly + 4))
      ctx.fillText(`${a}°`, tx, ty)
    }
  }

  // Horizontal baseline
  ctx.beginPath()
  ctx.moveTo(cx - radius - 4, cy)
  ctx.lineTo(cx + radius + 4, cy)
  ctx.strokeStyle = 'rgba(0,255,70,0.25)'
  ctx.stroke()

  // Sensor origin dot
  ctx.beginPath()
  ctx.arc(cx, cy, 3, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,255,70,0.8)'
  ctx.fill()
}
