import { useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import type { AvatarLook } from '../types'
import { AvatarModel, type AvatarMotion } from './Avatar'

function Spinner({ look }: { look: AvatarLook }) {
  const g = useRef<THREE.Group>(null)
  const motion = useRef<AvatarMotion>({ anim: 'idle', speed: 0 })
  useFrame((s) => {
    if (g.current) g.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.6) * 0.5
  })
  return (
    <group ref={g}>
      <AvatarModel look={look} motion={motion} castShadow={false} />
    </group>
  )
}

/** Small turntable shown on the welcome screen. Loaded lazily together with the 3D engine. */
export default function AvatarPreview({ look }: { look: AvatarLook }) {
  return (
    <Canvas dpr={[1, 2]} camera={{ fov: 30, position: [0, 1.0, 4.1] }} onCreated={({ camera }) => camera.lookAt(0, 0.78, 0)} gl={{ alpha: true, antialias: true }}>
      <hemisphereLight args={['#ffffff', '#b8bfa5', 1.6]} />
      <directionalLight position={[2, 4, 3]} intensity={1.6} />
      <Spinner look={look} />
    </Canvas>
  )
}
