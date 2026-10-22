import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { HALL } from '../lib/layout'
import { live } from '../state/store'
import { oakTexture } from './textures'
import { PALETTE, merge, paint, rng, vertexMat, wobble } from './util'

const T = HALL.wallThickness
const HW = HALL.width / 2
const H = HALL.height
const CZ = (HALL.frontZ + HALL.backZ) / 2
const DEPTH = HALL.frontZ - HALL.backZ
const ROOF_RISE = 2.4
const EAVE = 0.7

/** Wall box: exterior colour outside, matte gallery white inside. */
function Wall({ pos, size, inner }: { pos: [number, number, number]; size: [number, number, number]; inner: 'px' | 'nx' | 'pz' | 'nz' | 'none' }) {
  const mats = useMemo(() => {
    const out = new THREE.MeshLambertMaterial({ color: PALETTE.houseOuter, emissive: '#FFF8EE', emissiveIntensity: 0.12 })
    const inn = new THREE.MeshLambertMaterial({ color: PALETTE.wall, emissive: PALETTE.wall, emissiveIntensity: 0.42 })
    const order = ['px', 'nx', 'py', 'ny', 'pz', 'nz']
    return order.map((f) => (f === inner ? inn : out))
  }, [inner])
  return (
    <mesh position={pos} material={mats} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  )
}

function Window({ x, z, facing }: { x: number; z: number; facing: 1 | -1 }) {
  const w = 1.7
  const h = 1.6
  const y = 1.05 + h / 2
  return (
    <group position={[x, y, z + facing * (T / 2 + 0.02)]} rotation={[0, facing === 1 ? 0 : Math.PI, 0]}>
      <mesh>
        <boxGeometry args={[w + 0.16, h + 0.16, 0.05]} />
        <meshLambertMaterial color={'#E8E2D8'} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[w, h]} />
        <meshLambertMaterial color={'#CFE0E6'} emissive={'#DCEBF0'} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[0.05, h, 0.03]} />
        <meshLambertMaterial color={'#E8E2D8'} />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <boxGeometry args={[w, 0.05, 0.03]} />
        <meshLambertMaterial color={'#E8E2D8'} />
      </mesh>
      <mesh position={[0, -h / 2 - 0.1, 0.06]}>
        <boxGeometry args={[w + 0.3, 0.07, 0.16]} />
        <meshLambertMaterial color={'#E2DAD0'} />
      </mesh>
    </group>
  )
}

function Door() {
  const hinge = useRef<THREE.Group>(null)
  const open = useRef(0)
  useFrame((_, dt) => {
    const p = live.playerPos
    const near = Math.abs(p[0]) < 3.2 && Math.abs(p[2] - HALL.frontZ) < 3.4
    open.current += ((near ? 1 : 0) - open.current) * Math.min(1, dt * 4)
    if (hinge.current) hinge.current.rotation.y = -open.current * 1.75
  })
  const w = HALL.doorWidth
  return (
    <group ref={hinge} position={[-w / 2, 0, HALL.frontZ - 0.02]}>
      <mesh position={[w / 2 - 0.02, HALL.doorHeight / 2, 0]} castShadow>
        <boxGeometry args={[w - 0.06, HALL.doorHeight - 0.04, 0.08]} />
        <meshLambertMaterial color={'#C8AE90'} />
      </mesh>
      {[0.7, 1.75].map((y) => (
        <mesh key={y} position={[w / 2, y, 0.045]}>
          <boxGeometry args={[w - 0.5, 0.75, 0.02]} />
          <meshLambertMaterial color={'#BFA385'} />
        </mesh>
      ))}
      <mesh position={[w - 0.25, 1.25, 0.08]}>
        <sphereGeometry args={[0.05, 10, 8]} />
        <meshLambertMaterial color={'#C9B27A'} />
      </mesh>
    </group>
  )
}

function Roof() {
  const geo = useMemo(() => {
    const parts: THREE.BufferGeometry[] = []
    const half = HW + T / 2 + EAVE
    const slope = Math.hypot(half, ROOF_RISE)
    const ang = Math.atan2(ROOF_RISE, half)
    const len = DEPTH + T + EAVE * 2
    for (const side of [-1, 1]) {
      const g = new THREE.BoxGeometry(slope + 0.2, 0.22, len)
      g.rotateZ(side * -ang)
      g.translate((side * half) / 2, H + ROOF_RISE / 2 + 0.05, CZ)
      parts.push(paint(g, PALETTE.roof, 0.03, rng(side + 3)))
      // shingle lines
      for (let k = 1; k < 7; k++) {
        const s = new THREE.BoxGeometry(0.05, 0.04, len)
        const t = k / 7
        s.translate(side * half * (1 - t), H + ROOF_RISE * t + 0.2, CZ)
        parts.push(paint(s, '#8E756A'))
      }
    }
    const ridge = new THREE.BoxGeometry(0.3, 0.2, len + 0.05)
    ridge.translate(0, H + ROOF_RISE + 0.12, CZ)
    parts.push(paint(ridge, '#8A7064'))
    // gables (front + back triangles)
    for (const z of [HALL.frontZ, HALL.backZ]) {
      const shape = new THREE.Shape()
      shape.moveTo(-HW - T / 2, 0)
      shape.lineTo(HW + T / 2, 0)
      shape.lineTo(0, ROOF_RISE)
      shape.closePath()
      const g = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false })
      g.translate(0, H, z - T / 2)
      parts.push(paint(g, PALETTE.houseOuter))
    }
    // round attic window on the front gable
    const ring = new THREE.TorusGeometry(0.45, 0.06, 6, 20)
    ring.translate(0, H + 1.0, HALL.frontZ + T / 2 + 0.02)
    parts.push(paint(ring, '#E2DAD0'))
    const glass = new THREE.CircleGeometry(0.42, 20)
    glass.translate(0, H + 1.0, HALL.frontZ + T / 2 + 0.01)
    parts.push(paint(glass, '#CFE0E6'))
    return merge(parts.map((g) => (g.index ? g.toNonIndexed() : g)))
  }, [])
  const mat = useMemo(() => vertexMat({ flatShading: true }), [])
  return <mesh geometry={geo} material={mat} castShadow receiveShadow />
}

function Interior() {
  const floorMat = useMemo(() => {
    const t = oakTexture().clone()
    t.needsUpdate = true
    t.repeat.set(HALL.width / 3.2, DEPTH / 3.2)
    t.rotation = Math.PI / 2
    return new THREE.MeshLambertMaterial({ map: t, color: '#FFFFFF', emissive: '#FFF6EA', emissiveMap: t, emissiveIntensity: 0.35 })
  }, [])
  const plants = useMemo(() => {
    const r = rng(41)
    const parts: THREE.BufferGeometry[] = []
    const pot = new THREE.CylinderGeometry(0.32, 0.24, 0.55, 14)
    pot.translate(0, 0.275, 0)
    parts.push(paint(pot, '#E9E4DC'))
    for (let i = 0; i < 9; i++) {
      const g = wobble(new THREE.IcosahedronGeometry(0.22 + r() * 0.12, 0), 0.06, r)
      const a = r() * 6.28
      g.translate(Math.cos(a) * 0.25 * r(), 0.75 + r() * 0.9, Math.sin(a) * 0.25 * r())
      parts.push(paint(g, PALETTE.foliage[i % 4], 0.1, r))
    }
    const stem = new THREE.CylinderGeometry(0.03, 0.04, 1.2, 5)
    stem.translate(0, 0.9, 0)
    parts.push(paint(stem, PALETTE.trunk))
    return merge(parts)
  }, [])
  const plantMat = useMemo(() => vertexMat(), [])
  const plantSpots: [number, number][] = [
    [-HW + 0.8, HALL.backZ + 0.8],
    [HW - 0.8, HALL.backZ + 0.8],
    [-HW + 0.8, HALL.frontZ - 0.7],
    [HW - 0.8, HALL.frontZ - 0.7],
  ]
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, CZ]} material={floorMat}>
        <planeGeometry args={[HALL.width, DEPTH]} />
      </mesh>
      {/* ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H - 0.01, CZ]}>
        <planeGeometry args={[HALL.width, DEPTH]} />
        <meshLambertMaterial color={PALETTE.wall} emissive={PALETTE.wall} emissiveIntensity={0.55} />
      </mesh>
      {/* recessed ceiling lights */}
      {[-4, 0, 4].flatMap((x) =>
        [CZ - 3.5, CZ + 3.5].map((z) => (
          <mesh key={`${x},${z}`} rotation={[Math.PI / 2, 0, 0]} position={[x, H - 0.02, z]}>
            <circleGeometry args={[0.28, 20]} />
            <meshBasicMaterial color={'#FFF8EC'} toneMapped={false} />
          </mesh>
        )),
      )}
      {/* skirting boards */}
      {(
        [
          [0, HALL.backZ + T / 2 + 0.01, HALL.width, 0],
          [-HW + T / 2 + 0.01, CZ, DEPTH, Math.PI / 2],
          [HW - T / 2 - 0.01, CZ, DEPTH, -Math.PI / 2],
        ] as const
      ).map(([x, z, len, ry], i) => (
        <mesh key={i} position={[x, 0.07, z]} rotation={[0, ry, 0]}>
          <boxGeometry args={[len, 0.14, 0.03]} />
          <meshLambertMaterial color={'#EFEDE8'} />
        </mesh>
      ))}
      {/* a soft round rug and a minimal oak bench in the middle of the hall */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, CZ + 0.5]}>
        <circleGeometry args={[2.6, 48]} />
        <meshLambertMaterial color={'#E9E3D7'} />
      </mesh>
      <group position={[0, 0, CZ + 0.5]}>
        <mesh position={[0, 0.44, 0]} castShadow>
          <boxGeometry args={[2.4, 0.09, 0.6]} />
          <meshLambertMaterial color={PALETTE.oak} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 1.0, 0.2, 0]}>
            <boxGeometry args={[0.08, 0.4, 0.5]} />
            <meshLambertMaterial color={'#BFA07C'} />
          </mesh>
        ))}
      </group>
      {plantSpots.map(([x, z], i) => (
        <mesh key={i} geometry={plants} material={plantMat} position={[x, 0, z]} rotation={[0, i, 0]} />
      ))}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.25, 0.5, 0.35]} position={[0, 0.5, CZ + 0.5]} />
        {plantSpots.map(([x, z], i) => (
          <CylinderCollider key={i} args={[0.8, 0.38]} position={[x, 0.8, z]} />
        ))}
      </RigidBody>
      <pointLight position={[0, H - 0.5, CZ]} intensity={6} distance={13} decay={1.4} color={'#FFF6EA'} />
    </group>
  )
}

/** Corner trims, a little porch canopy and window boxes for the outside. */
function Exterior() {
  const geo = useMemo(() => {
    const r = rng(77)
    const parts: THREE.BufferGeometry[] = []
    const trim = PALETTE.houseTrim
    for (const x of [-HW, HW])
      for (const z of [HALL.frontZ, HALL.backZ]) {
        const g = new THREE.BoxGeometry(T + 0.16, H, T + 0.16)
        g.translate(x, H / 2, z)
        parts.push(paint(g, trim))
      }
    // eave band
    for (const z of [HALL.frontZ, HALL.backZ]) {
      const g = new THREE.BoxGeometry(HALL.width + T + 0.2, 0.18, T + 0.12)
      g.translate(0, H - 0.09, z)
      parts.push(paint(g, trim))
    }
    // porch canopy
    const cz = HALL.frontZ + 0.75
    for (const side of [-1, 1]) {
      const g = new THREE.BoxGeometry(1.75, 0.1, 1.5)
      g.rotateZ(side * -0.42)
      g.translate(side * 0.78, 3.25, cz)
      parts.push(paint(g, PALETTE.roof))
      const b = new THREE.BoxGeometry(0.08, 0.08, 1.3)
      b.translate(side * 1.35, 2.95, cz - 0.05)
      parts.push(paint(b, trim))
      const post = new THREE.BoxGeometry(0.08, 0.5, 0.08)
      post.rotateX(0.7)
      post.translate(side * 1.35, 2.85, HALL.frontZ + 0.35)
      parts.push(paint(post, trim))
    }
    // window boxes with white flowers
    for (const x of [-4.6, 4.6]) {
      const box = new THREE.BoxGeometry(1.9, 0.26, 0.3)
      box.translate(x, 0.88, HALL.frontZ + T / 2 + 0.2)
      parts.push(paint(box, '#B9987A'))
      for (let i = 0; i < 9; i++) {
        const leaf = wobble(new THREE.IcosahedronGeometry(0.13 + r() * 0.05, 0), 0.03, r)
        leaf.translate(x - 0.8 + i * 0.2, 1.06, HALL.frontZ + T / 2 + 0.2 + (r() - 0.5) * 0.1)
        parts.push(paint(leaf, PALETTE.foliage[i % 4], 0.1, r))
        const fl = new THREE.OctahedronGeometry(0.055, 0)
        fl.translate(x - 0.75 + i * 0.19, 1.17 + r() * 0.05, HALL.frontZ + T / 2 + 0.28)
        parts.push(paint(fl, PALETTE.flower))
      }
    }
    return merge(parts.map((g) => (g.index ? g.toNonIndexed() : g)))
  }, [])
  const mat = useMemo(() => vertexMat(), [])
  return <mesh geometry={geo} material={mat} castShadow receiveShadow />
}

export function House() {
  const dw = HALL.doorWidth / 2
  const sideLen = (HW + T / 2 - dw)
  return (
    <group>
      {/* stone plinth band around the outside of the walls */}
      {(
        [
          [0, HALL.backZ - T / 2 - 0.05, HALL.width + T + 0.2, 0.1],
          [-HW - T / 2 - 0.05, CZ, 0.1, DEPTH + T + 0.2],
          [HW + T / 2 + 0.05, CZ, 0.1, DEPTH + T + 0.2],
          [-(HW + dw) / 2 - 0.05, HALL.frontZ + T / 2 + 0.05, HW - dw + T / 2 + 0.1, 0.1],
          [(HW + dw) / 2 + 0.05, HALL.frontZ + T / 2 + 0.05, HW - dw + T / 2 + 0.1, 0.1],
        ] as const
      ).map(([x, z, sx, sz], i) => (
        <mesh key={i} position={[x, 0.16, z]}>
          <boxGeometry args={[sx, 0.32, sz]} />
          <meshLambertMaterial color={'#D8D1C5'} />
        </mesh>
      ))}
      {/* back wall (the main gallery wall with the portal) */}
      <Wall pos={[0, H / 2, HALL.backZ]} size={[HALL.width + T, H, T]} inner="pz" />
      {/* side walls */}
      <Wall pos={[-HW, H / 2, CZ]} size={[T, H, DEPTH - T]} inner="px" />
      <Wall pos={[HW, H / 2, CZ]} size={[T, H, DEPTH - T]} inner="nx" />
      {/* front wall with door opening */}
      <Wall pos={[-(dw + sideLen / 2), H / 2, HALL.frontZ]} size={[sideLen, H, T]} inner="nz" />
      <Wall pos={[dw + sideLen / 2, H / 2, HALL.frontZ]} size={[sideLen, H, T]} inner="nz" />
      <Wall pos={[0, (H + HALL.doorHeight) / 2, HALL.frontZ]} size={[dw * 2, H - HALL.doorHeight, T]} inner="nz" />
      {/* door frame */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (dw + 0.05), HALL.doorHeight / 2, HALL.frontZ + T / 2 + 0.02]}>
          <boxGeometry args={[0.12, HALL.doorHeight + 0.1, 0.06]} />
          <meshLambertMaterial color={'#E2DAD0'} />
        </mesh>
      ))}
      <mesh position={[0, HALL.doorHeight + 0.05, HALL.frontZ + T / 2 + 0.02]}>
        <boxGeometry args={[dw * 2 + 0.22, 0.12, 0.06]} />
        <meshLambertMaterial color={'#E2DAD0'} />
      </mesh>
      <mesh position={[0, 0.04, HALL.frontZ + 0.75]} receiveShadow>
        <boxGeometry args={[2.8, 0.08, 1.1]} />
        <meshLambertMaterial color={'#D9D3C7'} />
      </mesh>
      <Exterior />
      <Window x={-4.6} z={HALL.frontZ} facing={1} />
      <Window x={4.6} z={HALL.frontZ} facing={1} />
      <Window x={-4.6} z={HALL.frontZ} facing={-1} />
      <Window x={4.6} z={HALL.frontZ} facing={-1} />
      <Door />
      <Roof />
      <Interior />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[HW + T / 2, H / 2, T / 2]} position={[0, H / 2, HALL.backZ]} />
        <CuboidCollider args={[T / 2, H / 2, DEPTH / 2]} position={[-HW, H / 2, CZ]} />
        <CuboidCollider args={[T / 2, H / 2, DEPTH / 2]} position={[HW, H / 2, CZ]} />
        <CuboidCollider args={[sideLen / 2, H / 2, T / 2]} position={[-(dw + sideLen / 2), H / 2, HALL.frontZ]} />
        <CuboidCollider args={[sideLen / 2, H / 2, T / 2]} position={[dw + sideLen / 2, H / 2, HALL.frontZ]} />
        <CuboidCollider args={[dw, (H - HALL.doorHeight) / 2, T / 2]} position={[0, (H + HALL.doorHeight) / 2, HALL.frontZ]} />
        {/* ceiling + roof volume: keeps the camera from poking through */}
        <CuboidCollider args={[HW + T, 0.1, DEPTH / 2 + T]} position={[0, H + 0.1, CZ]} />
        <CuboidCollider args={[HW * 0.55, ROOF_RISE / 2, DEPTH / 2 + EAVE]} position={[0, H + ROOF_RISE / 2, CZ]} />
      </RigidBody>
    </group>
  )
}

/** Is a point inside the hall? Used for camera / lighting tweaks. */
export function insideHall(x: number, z: number) {
  return Math.abs(x) < HW && z < HALL.frontZ && z > HALL.backZ
}
