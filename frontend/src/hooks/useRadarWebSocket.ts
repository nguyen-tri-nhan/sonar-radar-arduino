import { useEffect, useRef, useState } from 'react'
import type { RadarReading } from '../types/radar'

const WS_URL = 'ws://localhost:8080/ws/radar'
const RECONNECT_DELAY_MS = 3_000

export function useRadarWebSocket(onReading: (r: RadarReading) => void) {
  const [connected, setConnected] = useState(false)
  const onReadingRef = useRef(onReading)

  useEffect(() => { onReadingRef.current = onReading })

  useEffect(() => {
    let ws: WebSocket
    let destroyed = false

    function connect() {
      ws = new WebSocket(WS_URL)

      ws.onopen = () => {
        setConnected(true)
        console.log('[WS] Connected to', WS_URL)
      }

      ws.onmessage = ({ data }) => {
        try {
          const msg = JSON.parse(data as string)
          if (msg.type === 'READING') onReadingRef.current(msg as RadarReading)
        } catch {
          console.warn('[WS] Parse error', data)
        }
      }

      ws.onclose = () => {
        setConnected(false)
        if (!destroyed) {
          console.log('[WS] Disconnected — reconnecting in 3s...')
          setTimeout(connect, RECONNECT_DELAY_MS)
        }
      }

      ws.onerror = () => ws.close()
    }

    connect()
    return () => { destroyed = true; ws?.close() }
  }, [])

  return { connected }
}
