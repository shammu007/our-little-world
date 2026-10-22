import { Suspense, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { input } from '../input/input'
import { useStore } from '../state/store'
import { Cake } from './Cake'
import { Gallery } from './Gallery'
import { Garden } from './Garden'
import { House } from './House'
import { Lighting } from './Lighting'
import { Player } from './Player'
import { Portal } from './Portal'
import { RemotePlayers } from './RemotePlayers'

function ReadySignal() {
  const frames = useRef(0)
  useFrame(() => {
    frames.current++
    if (frames.current === 3) useStore.setState({ worldReady: true })
  })
  return null
}

/** Mouse drag rotates the camera, wheel zooms. Touch is handled by the on-screen controls. */
function MouseLook() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    const el = gl.domElement
    let dragging = false
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      dragging = true
      el.setPointerCapture(e.pointerId)
      el.style.cursor = 'grabbing'
    }
    const move = (e: PointerEvent) => {
      if (!dragging || e.pointerType !== 'mouse') return
      input.look.dx += e.movementX * 0.0048
      input.look.dy += e.movementY * 0.0036
    }
    const up = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      dragging = false
      el.style.cursor = 'grab'
    }
    const wheel = (e: WheelEvent) => {
      input.zoom += Math.sign(e.deltaY) * Math.min(1, Math.abs(e.deltaY) / 100) * 0.5
      e.preventDefault()
    }
    el.style.cursor = 'grab'
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('wheel', wheel, { passive: false })
    el.addEventListener('contextmenu', (e) => e.preventDefault())
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('wheel', wheel)
    }
  }, [gl])
  return null
}

export default function World() {
  const quality = useStore((s) => s.settings.quality)
  const identity = useStore((s) => s.identity)
  const high = quality === 'high'
  if (!identity) return null
  return (
    <Canvas
      key={quality}
      className="world-canvas"
      shadows={high ? { type: THREE.PCFSoftShadowMap } : false}
      dpr={high ? [1, 1.75] : [1, 1.25]}
      gl={{ antialias: high, powerPreference: 'high-performance', alpha: false }}
      camera={{ fov: 55, near: 0.1, far: 400, position: [0, 8, 45] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping
        gl.toneMappingExposure = 1.0
        gl.outputColorSpace = THREE.SRGBColorSpace
      }}
    >
      <Suspense fallback={null}>
        <Physics gravity={[0, -9.81, 0]} timeStep="vary">
          <Lighting />
          <Garden />
          <Cake />
          <House />
          <Gallery />
          <Portal />
          <Player look={identity.look} />
          <RemotePlayers />
          <MouseLook />
          <ReadySignal />
        </Physics>
      </Suspense>
    </Canvas>
  )
}
