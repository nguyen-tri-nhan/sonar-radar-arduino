import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { MAX_RANGE_M, toCanvasXY } from '../utils/radarMath'
import type { RadarPoint } from '../types/radar'

const FADE_DURATION_MS = 3000
const SWEEP_COLOR = 'rgba(0, 255, 70, 0.8)'
const POINT_RADIUS = 4
const RANGE_RINGS = [1, 2, 3, 4]

export interface RadarCanvasHandle {
  addPoint: (angle: number, distanceM: number) => void
}

interface Props {
  size: number
}

export const RadarCanvas = forwardRef<RadarCanvasHandle, Props>(({ size }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointsRef = useRef<RadarPoint[]>([])
  const sweepAngleRef = useRef<number | null>(null)

  useImperativeHandle(ref, () => ({
    addPoint(angle: number, distanceM: number) {
      sweepAngleRef.current = angle
      if (distanceM > 0 && distanceM <= MAX_RANGE_M) {
        pointsRef.current.push({ angle, distanceM, alpha: 1 })
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
      const cx = w / 2
      const cy = h / 2
      const radius = Math.min(cx, cy) - 4

      ctx.clearRect(0, 0, w, h)
      drawGrid(ctx, cx, cy, radius)

      // Fade and draw points
      pointsRef.current = pointsRef.current.filter(p => p.alpha > 0)
      for (const p of pointsRef.current) {
        p.alpha = Math.max(0, p.alpha - dt / FADE_DURATION_MS)
        const { x, y } = toCanvasXY(p.angle, p.distanceM, cx, cy, radius)
        ctx.beginPath()
        ctx.arc(x, y, POINT_RADIUS, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0, 255, 70, ${p.alpha})`
        ctx.fill()
      }

      // Sweep line
      if (sweepAngleRef.current !== null) {
        const rad = (sweepAngleRef.current * Math.PI) / 180
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + radius * Math.cos(rad), cy - radius * Math.sin(rad))
        ctx.strokeStyle = SWEEP_COLOR
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [size])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ display: 'block', background: '#001a00' }}
    />
  )
})

RadarCanvas.displayName = 'RadarCanvas'

function drawGrid(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  ctx.strokeStyle = 'rgba(0, 255, 70, 0.2)'
  ctx.fillStyle = 'rgba(0, 255, 70, 0.5)'
  ctx.font = '11px monospace'
  ctx.lineWidth = 1

  // Range rings
  for (const m of RANGE_RINGS) {
    const r = (m / MAX_RANGE_M) * radius
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillText(`${m}m`, cx + 3, cy - r + 12)
  }

  // Angle lines every 30°
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + radius * Math.cos(rad), cy - radius * Math.sin(rad))
    ctx.stroke()
  }

  // Crosshair
  ctx.beginPath()
  ctx.moveTo(cx - radius, cy)
  ctx.lineTo(cx + radius, cy)
  ctx.moveTo(cx, cy - radius)
  ctx.lineTo(cx, cy + radius)
  ctx.stroke()
}
