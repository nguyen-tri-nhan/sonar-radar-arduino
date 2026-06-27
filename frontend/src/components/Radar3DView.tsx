import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { MAX_RANGE_M } from '../utils/radarMath'

const FADE_MS = 4000
const MAX_PTS = 500

interface Pt {
  x: number; y: number; z: number
  alpha: number
  birth: number
}

export interface Radar3DViewHandle {
  addPoint: (pan: number, tilt: number, distanceM: number) => void
}

// Three.js Y-up convention:
//   x = d·cos(tilt)·cos(pan)
//   y = d·sin(tilt)            ← up
//   z = -d·cos(tilt)·sin(pan)
function toXYZ(pan: number, tilt: number, dm: number): [number, number, number] {
  const pr = (pan  * Math.PI) / 180
  const tr = (tilt * Math.PI) / 180
  return [
    dm * Math.cos(tr) * Math.cos(pr),
    dm * Math.sin(tr),
    -dm * Math.cos(tr) * Math.sin(pr),
  ]
}

// ── inner scene ───────────────────────────────────────────────────────
interface SceneProps {
  pointsRef: { current: Pt[] }
  sweepRef:  { current: { pan: number; tilt: number } | null }
}

function Scene({ pointsRef, sweepRef }: SceneProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy   = useMemo(() => new THREE.Object3D(), [])

  // Detection point: bright emissive sphere — MeshStandardMaterial gives real glow
  const [meshGeo, meshMat] = useMemo(() => [
    new THREE.SphereGeometry(0.08, 10, 10),
    new THREE.MeshStandardMaterial({
      color:            new THREE.Color('#44ffaa'),
      emissive:         new THREE.Color('#00ff66'),
      emissiveIntensity: 4,
      roughness:        0.2,
      metalness:        0.1,
    }),
  ], [])

  // Range rings on XZ plane — brighter than before
  const rings = useMemo(() =>
    [1, 2, 3, 4].map(r => {
      const pts: number[] = []
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2
        pts.push(r * Math.cos(a), 0, r * Math.sin(a))
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
      return new THREE.LineLoop(geo, new THREE.LineBasicMaterial({ color: 0x004422 }))
    }), [])

  // Sweep ray — dynamic end, updated each frame
  const sweepLine = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, MAX_RANGE_M,0,0], 3))
    return new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0x00ff66, transparent: true, opacity: 0.8 }),
    )
  }, [])

  useFrame(() => {
    const now = Date.now()

    // Fade and cull
    for (const p of pointsRef.current) p.alpha = Math.max(0, 1 - (now - p.birth) / FADE_MS)
    pointsRef.current = pointsRef.current.filter(p => p.alpha > 0)

    // Update instanced mesh — fade via SCALE (sphere shrinks as it ages)
    const mesh = meshRef.current
    if (mesh) {
      const pts = pointsRef.current
      mesh.count = pts.length
      for (let i = 0; i < pts.length; i++) {
        const { x, y, z, alpha } = pts[i]
        dummy.position.set(x, y, z)
        dummy.scale.setScalar(alpha)   // fresh = full-size, old = shrinks to zero
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }

    // Sweep ray end point
    if (sweepRef.current) {
      const [ex, ey, ez] = toXYZ(sweepRef.current.pan, sweepRef.current.tilt, MAX_RANGE_M)
      const pos = sweepLine.geometry.attributes.position as THREE.BufferAttribute
      pos.setXYZ(1, ex, ey, ez)
      pos.needsUpdate = true
    }
  })

  return (
    <>
      {/* True dark background — overrides WebGL clear default */}
      <color attach="background" args={[0x050510]} />

      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 4, 2]} intensity={0.8} color="#ffffff" />
      <pointLight position={[0, 3, 0]} intensity={2} color="#00ff66" distance={6} decay={2} />

      {/* Radar sensor at origin — bright beacon */}
      <mesh>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#00ff46"
          emissiveIntensity={5}
        />
      </mesh>

      {/* Ground grid */}
      <gridHelper args={[MAX_RANGE_M * 2, MAX_RANGE_M * 2, '#003322', '#001a0e']} />

      {/* Range rings */}
      {rings.map((r, i) => <primitive key={i} object={r} />)}

      {/* Sweep ray */}
      <primitive object={sweepLine} />

      {/* Detection points — scale-fade with emissive glow */}
      <instancedMesh ref={meshRef} args={[meshGeo, meshMat, MAX_PTS]} />
    </>
  )
}

// ── exported component ────────────────────────────────────────────────
export const Radar3DView = forwardRef<Radar3DViewHandle, {}>((_, ref) => {
  const pointsRef = useRef<Pt[]>([])
  const sweepRef  = useRef<{ pan: number; tilt: number } | null>(null)

  useImperativeHandle(ref, () => ({
    addPoint(pan: number, tilt: number, distanceM: number) {
      sweepRef.current = { pan, tilt }
      if (distanceM > 0 && distanceM <= MAX_RANGE_M) {
        const [x, y, z] = toXYZ(pan, tilt, distanceM)
        pointsRef.current.push({ x, y, z, alpha: 1, birth: Date.now() })
        if (pointsRef.current.length > MAX_PTS) pointsRef.current.shift()
      }
    },
  }))

  return (
    <div className="canvas-3d-wrap">
      <Canvas
        camera={{ position: [3, 2.5, 3], fov: 55 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      >
        <Scene pointsRef={pointsRef} sweepRef={sweepRef} />
        <OrbitControls enablePan={false} />
      </Canvas>
    </div>
  )
})

Radar3DView.displayName = 'Radar3DView'
