import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import type { AvatarLook } from '../types'
import { glowTexture } from './textures'

export interface AvatarMotion {
  anim: string
  speed: number
}

const matCache = new Map<string, THREE.MeshLambertMaterial>()
const mat = (c: string) => {
  let m = matCache.get(c)
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: c })
    matCache.set(c, m)
  }
  return m
}

const geo = {
  head: new THREE.SphereGeometry(0.27, 24, 18),
  hairCap: new THREE.SphereGeometry(0.29, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
  eye: new THREE.SphereGeometry(0.03, 10, 8),
  eyeShine: new THREE.SphereGeometry(0.009, 6, 4),
  blush: new THREE.CircleGeometry(0.04, 14),
  smile: new THREE.TorusGeometry(0.04, 0.008, 5, 12, Math.PI),
  torso: new THREE.CapsuleGeometry(0.19, 0.22, 6, 16),
  arm: (() => {
    const g = new THREE.CapsuleGeometry(0.055, 0.24, 4, 10)
    g.translate(0, -0.15, 0)
    return g
  })(),
  hand: new THREE.SphereGeometry(0.06, 10, 8),
  leg: (() => {
    const g = new THREE.CapsuleGeometry(0.07, 0.26, 4, 10)
    g.translate(0, -0.18, 0)
    return g
  })(),
  shoe: (() => {
    const g = new THREE.SphereGeometry(0.085, 12, 8)
    g.scale(1, 0.6, 1.45)
    g.translate(0, -0.37, 0.03)
    return g
  })(),
  skirt: new THREE.CylinderGeometry(0.18, 0.33, 0.36, 20, 1, true),
  skirtBottom: new THREE.RingGeometry(0.0, 0.33, 20),
  hairBack: (() => {
    const g = new THREE.SphereGeometry(0.27, 18, 14)
    g.scale(1.02, 1.35, 0.62)
    return g
  })(),
  bun: new THREE.SphereGeometry(0.11, 12, 10),
  fringe: (() => {
    const g = new THREE.SphereGeometry(0.2, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.4)
    g.scale(1.25, 0.6, 0.9)
    return g
  })(),
  collar: new THREE.TorusGeometry(0.12, 0.03, 6, 16),
}

export function AvatarModel({ look, motion, castShadow = true }: { look: AvatarLook; motion: React.MutableRefObject<AvatarMotion>; castShadow?: boolean }) {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const phase = useRef(Math.random() * 10)
  const blink = useRef(0)
  const eyes = useRef<THREE.Group>(null)
  const female = look.kind === 'female'
  const shadowMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#2a3020', transparent: true, opacity: 0.32, depthWrite: false }),
    [],
  )

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const { anim, speed } = motion.current
    const t = state.clock.elapsedTime
    const moving = anim === 'walk' || anim === 'run'
    const freq = anim === 'run' ? 11 : 7.5
    if (moving) phase.current += dt * freq * Math.max(0.5, Math.min(1.4, speed / (anim === 'run' ? 5 : 3)))
    const ph = phase.current
    const amp = anim === 'run' ? 0.85 : moving ? 0.55 : 0
    const k = Math.min(1, dt * 12)
    const lerp = (r: THREE.Group | null, x: number, z = 0) => {
      if (!r) return
      r.rotation.x += (x - r.rotation.x) * k
      r.rotation.z += (z - r.rotation.z) * k
    }
    if (anim === 'jump') {
      lerp(legL.current, -0.6)
      lerp(legR.current, 0.3)
      lerp(armL.current, -2.4, 0.3)
      lerp(armR.current, -2.4, -0.3)
    } else {
      lerp(legL.current, Math.sin(ph) * amp)
      lerp(legR.current, -Math.sin(ph) * amp)
      lerp(armL.current, -Math.sin(ph) * amp * 0.8, 0.08 + (moving ? 0 : Math.sin(t * 1.6) * 0.02))
      lerp(armR.current, Math.sin(ph) * amp * 0.8, -0.08 - (moving ? 0 : Math.sin(t * 1.6) * 0.02))
    }
    if (body.current) {
      const bob = moving ? Math.abs(Math.sin(ph)) * (anim === 'run' ? 0.06 : 0.035) : Math.sin(t * 2) * 0.006
      body.current.position.y = bob
      body.current.rotation.x += ((anim === 'run' ? 0.14 : moving ? 0.05 : 0) - body.current.rotation.x) * k
    }
    if (head.current) {
      head.current.rotation.z = moving ? Math.sin(ph) * 0.04 : Math.sin(t * 0.9) * 0.05
      head.current.rotation.x = moving ? 0 : Math.sin(t * 0.7) * 0.03
    }
    // blink every few seconds
    blink.current -= dt
    if (eyes.current) {
      if (blink.current < -0.12) blink.current = 2 + Math.random() * 3
      eyes.current.scale.y = blink.current < 0 ? 0.1 : 1
    }
  })

  const skin = mat(look.skin)
  const hair = mat(look.hair)
  const top = mat(look.top)
  const bottom = mat(look.bottom)
  const shoes = mat(look.shoes)
  const dark = mat('#2F2A28')
  const white = mat('#FFFFFF')
  const blushM = useMemo(() => new THREE.MeshBasicMaterial({ color: '#EBA7A0', transparent: true, opacity: 0.55 }), [])
  const cs = castShadow

  return (
    <group ref={root}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} material={shadowMat}>
        <planeGeometry args={[0.9, 0.9]} />
      </mesh>
      <group ref={body}>
        {/* legs */}
        <group ref={legL} position={[-0.09, 0.47, 0]}>
          <mesh geometry={geo.leg} material={female ? skin : bottom} castShadow={cs} />
          <mesh geometry={geo.shoe} material={shoes} castShadow={cs} />
        </group>
        <group ref={legR} position={[0.09, 0.47, 0]}>
          <mesh geometry={geo.leg} material={female ? skin : bottom} castShadow={cs} />
          <mesh geometry={geo.shoe} material={shoes} castShadow={cs} />
        </group>
        {/* torso */}
        <mesh geometry={geo.torso} material={top} position={[0, 0.74, 0]} castShadow={cs} />
        {female ? (
          <>
            <mesh geometry={geo.skirt} material={bottom} position={[0, 0.6, 0]} castShadow={cs} />
            <mesh geometry={geo.skirtBottom} material={bottom} position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]} />
          </>
        ) : (
          <mesh geometry={geo.collar} material={white} position={[0, 0.96, 0.02]} rotation={[Math.PI / 2 - 0.25, 0, 0]} />
        )}
        {/* arms */}
        <group ref={armL} position={[-0.235, 0.9, 0]}>
          <mesh geometry={geo.arm} material={top} castShadow={cs} />
          <mesh geometry={geo.hand} material={skin} position={[0, -0.33, 0]} />
        </group>
        <group ref={armR} position={[0.235, 0.9, 0]}>
          <mesh geometry={geo.arm} material={top} castShadow={cs} />
          <mesh geometry={geo.hand} material={skin} position={[0, -0.33, 0]} />
        </group>
        {/* head */}
        <group ref={head} position={[0, 1.22, 0]}>
          <mesh geometry={geo.head} material={skin} castShadow={cs} />
          <mesh geometry={geo.hairCap} material={hair} position={[0, 0.02, -0.02]} rotation={[-0.35, 0, 0]} castShadow={cs} />
          <mesh geometry={geo.fringe} material={hair} position={[female ? 0.04 : 0.02, 0.1, 0.1]} rotation={[0.5, 0, female ? -0.25 : 0.2]} />
          {female && (
            <>
              <mesh geometry={geo.hairBack} material={hair} position={[0, -0.08, -0.1]} castShadow={cs} />
              <mesh geometry={geo.bun} material={hair} position={[0, 0.27, -0.12]} />
            </>
          )}
          <group ref={eyes} position={[0, 0.0, 0.245]}>
            <mesh geometry={geo.eye} material={dark} position={[-0.095, 0, 0]} />
            <mesh geometry={geo.eye} material={dark} position={[0.095, 0, 0]} />
            <mesh geometry={geo.eyeShine} material={white} position={[-0.085, 0.012, 0.026]} />
            <mesh geometry={geo.eyeShine} material={white} position={[0.105, 0.012, 0.026]} />
          </group>
          <mesh geometry={geo.blush} material={blushM} position={[-0.16, -0.07, 0.215]} rotation={[0, -0.55, 0]} />
          <mesh geometry={geo.blush} material={blushM} position={[0.16, -0.07, 0.215]} rotation={[0, 0.55, 0]} />
          <mesh geometry={geo.smile} material={dark} position={[0, -0.075, 0.262]} rotation={[0, 0, Math.PI]} />
        </group>
      </group>
    </group>
  )
}
