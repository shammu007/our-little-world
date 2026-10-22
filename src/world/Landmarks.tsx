import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { useStore } from '../state/store'
import { PALETTE, heartGeometry, merge, paint, rng, vertexMat, wobble } from './util'

export const FOUNTAIN = { x: -10.5, z: 1, r: 2.4 }
export const HEART_TREE = { x: 10.5, z: -3.5 }

/* ---------- tiered stone fountain ---------- */

function fountainGeo() {
  const r = rng(41)
  const stone = PALETTE.stone
  const parts: THREE.BufferGeometry[] = []
  const add = (g: THREE.BufferGeometry, y: number, color = stone) => {
    g.translate(0, y, 0)
    parts.push(paint(g, color, 0.05, r))
  }
  // basin wall and rim
  add(new THREE.CylinderGeometry(2.3, 2.45, 0.55, 30, 1, true), 0.275)
  add(new THREE.CylinderGeometry(2.0, 2.0, 0.5, 30, 1, true), 0.25, '#A9A59E')
  add(new THREE.TorusGeometry(2.15, 0.17, 6, 36).rotateX(Math.PI / 2), 0.56)
  // central column with a bulge
  add(new THREE.CylinderGeometry(0.26, 0.42, 1.25, 10), 1.0)
  add(new THREE.SphereGeometry(0.42, 10, 6).scale(1, 0.55, 1), 1.15)
  // middle bowl
  add(new THREE.CylinderGeometry(1.25, 0.35, 0.38, 24), 1.82)
  add(new THREE.TorusGeometry(1.22, 0.09, 5, 30).rotateX(Math.PI / 2), 2.0)
  // upper column and bowl
  add(new THREE.CylinderGeometry(0.15, 0.24, 0.75, 8), 2.38)
  add(new THREE.CylinderGeometry(0.68, 0.22, 0.26, 20), 2.84)
  add(new THREE.TorusGeometry(0.66, 0.06, 5, 24).rotateX(Math.PI / 2), 2.97)
  // finial
  add(new THREE.CylinderGeometry(0.08, 0.12, 0.35, 8), 3.15)
  add(new THREE.SphereGeometry(0.14, 10, 8), 3.4)
  add(new THREE.ConeGeometry(0.09, 0.22, 8), 3.6)
  return merge(parts)
}

function waterTexture() {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#9BD8F7'
  g.fillRect(0, 0, 64, 128)
  const r = rng(3)
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.5})`
    g.fillRect(r() * 64, r() * 128, 1.5 + r() * 2, 10 + r() * 30)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export function Fountain() {
  const reduced = useStore((s) => s.settings.reducedMotion)
  const geo = useMemo(() => fountainGeo(), [])
  const mat = useMemo(() => vertexMat(), [])
  const fall = useMemo(() => {
    const t = waterTexture()
    t.repeat.set(10, 1)
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
  }, [])
  const pool = useMemo(() => new THREE.MeshLambertMaterial({ color: '#5EC2EE', emissive: '#2F86C9', emissiveIntensity: 0.25, transparent: true, opacity: 0.88 }), [])
  const ripple = useRef<THREE.Mesh>(null)
  useFrame((state, dt) => {
    if (reduced) return
    fall.map!.offset.y -= dt * 0.9
    const s = 1 + ((state.clock.elapsedTime * 0.5) % 1) * 0.9
    if (ripple.current) {
      ripple.current.scale.set(s, s, 1)
      ;(ripple.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - (s - 1) / 0.9)
    }
  })
  return (
    <group position={[FOUNTAIN.x, 0, FOUNTAIN.z]}>
      <mesh geometry={geo} material={mat} castShadow receiveShadow />
      {/* water surfaces */}
      <mesh material={pool} position={[0, 0.46, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.05, 36]} />
      </mesh>
      <mesh material={pool} position={[0, 1.97, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.16, 28]} />
      </mesh>
      <mesh material={pool} position={[0, 2.95, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.62, 20]} />
      </mesh>
      <mesh ref={ripple} position={[0, 0.47, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.25, 1.35, 36]} />
        <meshBasicMaterial color={'#FFFFFF'} transparent opacity={0.4} depthWrite={false} />
      </mesh>
      {/* falling water curtains */}
      <mesh material={fall} position={[0, 1.24, 0]}>
        <cylinderGeometry args={[1.28, 1.42, 1.5, 28, 1, true]} />
      </mesh>
      <mesh material={fall} position={[0, 2.47, 0]}>
        <cylinderGeometry args={[0.7, 0.8, 1.0, 20, 1, true]} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1.0, FOUNTAIN.r + 0.1]} position={[0, 1.0, 0]} />
      </RigidBody>
    </group>
  )
}

/* ---------- big red heart tree ---------- */

export function HeartTree() {
  const reduced = useStore((s) => s.settings.reducedMotion)
  const trunk = useMemo(() => {
    const r = rng(8)
    const parts: THREE.BufferGeometry[] = []
    const t = new THREE.CylinderGeometry(0.22, 0.42, 3.4, 8, 3)
    t.translate(0, 1.7, 0)
    parts.push(paint(wobble(t, 0.06, r), PALETTE.trunk, 0.08, r))
    for (const side of [-1, 1]) {
      const b = new THREE.CylinderGeometry(0.07, 0.13, 1.1, 6)
      b.rotateZ(-side * 0.75)
      b.translate(side * 0.38, 3.0, 0)
      parts.push(paint(b, PALETTE.trunk, 0.08, r))
    }
    // grassy mound at the foot
    const m = new THREE.CylinderGeometry(1.55, 1.8, 0.22, 20)
    m.translate(0, 0.11, 0)
    parts.push(paint(m, '#9BDB6A', 0.04, r))
    return merge(parts)
  }, [])
  const heart = useMemo(() => heartGeometry(4.0, 0.42, 14), [])
  const small = useMemo(() => heartGeometry(0.42, 0.4, 8), [])
  const red = useMemo(() => new THREE.MeshLambertMaterial({ color: '#EE2A35', emissive: '#B0141E', emissiveIntensity: 0.35 }), [])
  const mat = useMemo(() => vertexMat(), [])
  const big = useRef<THREE.Mesh>(null)
  const floaters = useRef<THREE.Group>(null)
  const drift = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({ a: (i / 6) * Math.PI * 2, r: 2.4 + (i % 2) * 0.5, y: 2.6 + (i % 3) * 0.9, sp: 0.25 + (i % 3) * 0.08 })),
    [],
  )
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (big.current && !reduced) {
      const k = 1 + Math.sin(t * 2.2) * 0.02
      big.current.scale.set(k, k, k)
      big.current.rotation.y = Math.sin(t * 0.4) * 0.12
    }
    floaters.current?.children.forEach((c, i) => {
      const d = drift[i]
      const a = d.a + (reduced ? 0 : t * d.sp)
      c.position.set(Math.cos(a) * d.r, d.y + (reduced ? 0 : Math.sin(t * 1.3 + i) * 0.25), Math.sin(a) * d.r)
      c.rotation.y = -a
    })
  })
  return (
    <group position={[HEART_TREE.x, 0, HEART_TREE.z]} rotation={[0, -0.5, 0]}>
      <mesh geometry={trunk} material={mat} castShadow receiveShadow />
      <mesh ref={big} geometry={heart} material={red} position={[0, 5.0, 0]} castShadow />
      <group ref={floaters}>
        {drift.map((_, i) => (
          <mesh key={i} geometry={small} material={red} castShadow={false} />
        ))}
      </group>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1.7, 0.45]} position={[0, 1.7, 0]} />
      </RigidBody>
    </group>
  )
}

/* ---------- white benches with little red hearts ---------- */

export function HeartBenches() {
  const spots: [number, number][] = [
    [-6.4, 2.2],
    [6.4, 2.2],
  ]
  const heart = useMemo(() => heartGeometry(0.2, 0.35, 8), [])
  const legs = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    for (const lx of [-0.7, 0.7]) {
      const g = new THREE.BoxGeometry(0.08, 0.44, 0.44)
      g.translate(lx, 0.22, 0)
      parts.push(paint(g, '#C9A27E'))
      const post = new THREE.BoxGeometry(0.07, 0.75, 0.07)
      post.translate(lx, 0.82, -0.24)
      parts.push(paint(post, '#FFFFFF'))
    }
    return merge(parts)
  }, [])
  const mat = useMemo(() => vertexMat(), [])
  return (
    <>
      {spots.map(([x, z], i) => {
        const ry = Math.atan2(-x, -z)
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, ry, 0]}>
            <mesh geometry={legs} material={mat} castShadow />
            <mesh position={[0, 0.45, 0]} castShadow>
              <boxGeometry args={[1.7, 0.08, 0.5]} />
              <meshLambertMaterial color={'#FFFDF8'} />
            </mesh>
            {[0.68, 0.86, 1.04].map((y) => (
              <mesh key={y} position={[0, y, -0.25]} castShadow>
                <boxGeometry args={[1.5, 0.08, 0.04]} />
                <meshLambertMaterial color={'#FFFDF8'} />
              </mesh>
            ))}
            {[-0.45, 0.45].map((hx) => (
              <mesh key={hx} geometry={heart} position={[hx, 1.22, -0.25]}>
                <meshLambertMaterial color={'#E3262F'} />
              </mesh>
            ))}
          </group>
        )
      })}
      <RigidBody type="fixed" colliders={false}>
        {spots.map(([x, z], i) => (
          <CuboidCollider key={i} args={[0.9, 0.5, 0.35]} position={[x, 0.5, z]} rotation={[0, Math.atan2(-x, -z), 0]} />
        ))}
      </RigidBody>
    </>
  )
}
