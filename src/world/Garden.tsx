import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { HALL, SPAWN } from '../lib/layout'
import { useStore } from '../state/store'
import { PALETTE, merge, paint, rng, vertexMat, wobble } from './util'
import { FOUNTAIN, Fountain, HEART_TREE, HeartBenches, HeartTree } from './Landmarks'

export const GARDEN = { radius: 40, spawn: SPAWN, gateZ: 37.2, plazaRadius: 4.4 }

/** x offset of the winding south path at a given z */
export const pathX = (z: number) => (z > GARDEN.plazaRadius ? Math.sin(z * 0.14) * 1.3 * Math.min(1, (z - GARDEN.plazaRadius) / 6) : 0)

const houseRect = { x0: -HALL.width / 2 - 3, x1: HALL.width / 2 + 3, z0: HALL.backZ - 3, z1: HALL.frontZ + 3 }

function onPath(x: number, z: number, margin: number) {
  if (Math.hypot(x, z) < GARDEN.plazaRadius + margin) return true
  if (z > 0 && z < GARDEN.radius && Math.abs(x - pathX(z)) < 1.3 + margin) return true
  if (z < 0 && z > HALL.frontZ - 1 && Math.abs(x) < 1.3 + margin) return true
  return false
}
/* Fountain and heart tree: kept clear of scattered trees and flowers. */
const features: [number, number, number][] = [
  [FOUNTAIN.x, FOUNTAIN.z, FOUNTAIN.r + 0.6],
  [HEART_TREE.x, HEART_TREE.z, 2.2],
]
function nearFeature(x: number, z: number, m = 0) {
  return features.some(([fx, fz, fr]) => Math.hypot(x - fx, z - fz) < fr + m)
}
function inHouse(x: number, z: number, m = 0) {
  return x > houseRect.x0 - m && x < houseRect.x1 + m && z > houseRect.z0 - m && z < houseRect.z1 + m
}

/* ---------- geometry builders ---------- */

function deciduousGeo(seed: number) {
  const r = rng(seed)
  const parts: THREE.BufferGeometry[] = []
  const trunk = new THREE.CylinderGeometry(0.11, 0.2, 1.9, 6, 2)
  trunk.translate(0, 0.95, 0)
  parts.push(paint(trunk, PALETTE.trunk, 0.1, r))
  const branch = new THREE.CylinderGeometry(0.05, 0.08, 0.9, 5)
  branch.rotateZ(0.7)
  branch.translate(0.3, 1.7, 0)
  parts.push(paint(branch, PALETTE.trunk, 0.1, r))
  const blobs = 4 + Math.floor(r() * 2)
  for (let i = 0; i < blobs; i++) {
    const rad = 0.75 + r() * 0.45
    const g = wobble(new THREE.IcosahedronGeometry(rad, 1), 0.18, r)
    const a = (i / blobs) * Math.PI * 2 + r()
    const d = i === 0 ? 0 : 0.55 + r() * 0.3
    g.scale(1, 0.85, 1)
    g.translate(Math.cos(a) * d, 2.35 + r() * 0.7 + (i === 0 ? 0.35 : 0), Math.sin(a) * d)
    parts.push(paint(g, PALETTE.foliage[Math.floor(r() * PALETTE.foliage.length)], 0.12, r))
  }
  return merge(parts)
}

function coniferGeo(seed: number) {
  const r = rng(seed)
  const parts: THREE.BufferGeometry[] = []
  const trunk = new THREE.CylinderGeometry(0.1, 0.16, 1.2, 6)
  trunk.translate(0, 0.6, 0)
  parts.push(paint(trunk, PALETTE.trunk, 0.1, r))
  for (let i = 0; i < 3; i++) {
    const g = wobble(new THREE.ConeGeometry(1.15 - i * 0.28, 1.5, 7, 1), 0.08, r)
    g.translate(0, 1.4 + i * 0.85, 0)
    parts.push(paint(g, i % 2 ? '#3F8C45' : '#4C9E4E', 0.12, r))
  }
  return merge(parts)
}

/** A garden rose: stem, two leaves and a layered bloom. */
function roseGeo() {
  const r = rng(13)
  const parts: THREE.BufferGeometry[] = []
  const red = PALETTE.rose
  const stem = new THREE.CylinderGeometry(0.012, 0.016, 0.42, 4)
  stem.translate(0, 0.21, 0)
  parts.push(paint(stem, '#3F8A30'))
  for (const [side, y] of [[-1, 0.16], [1, 0.26]] as const) {
    const leaf = new THREE.SphereGeometry(0.05, 6, 4)
    leaf.scale(1.9, 0.25, 0.9)
    leaf.translate(side * 0.07, y, 0)
    parts.push(paint(leaf, '#4CAF3C', 0.05, r))
  }
  const sepal = new THREE.ConeGeometry(0.05, 0.06, 5)
  sepal.rotateX(Math.PI)
  sepal.translate(0, 0.43, 0)
  parts.push(paint(sepal, '#3F8A30'))
  // outer petals open out, inner ones wrap a tight bud
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const p = new THREE.SphereGeometry(0.06, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2)
    p.scale(1, 0.55, 0.35)
    p.rotateX(-1.0)
    p.rotateY(-a + Math.PI / 2)
    p.translate(Math.cos(a) * 0.05, 0.47, Math.sin(a) * 0.05)
    parts.push(paint(p, red, 0.08, r))
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5
    const p = new THREE.SphereGeometry(0.045, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2)
    p.scale(1, 0.8, 0.4)
    p.rotateX(-0.45)
    p.rotateY(-a + Math.PI / 2)
    p.translate(Math.cos(a) * 0.022, 0.48, Math.sin(a) * 0.022)
    parts.push(paint(p, red, 0.08, r))
  }
  const bud = new THREE.SphereGeometry(0.03, 6, 5)
  bud.scale(1, 1.3, 1)
  bud.translate(0, 0.52, 0)
  parts.push(paint(bud, '#C8121E'))
  return merge(parts)
}

/** Two neat rows of roses lining both sides of the paths. */
function roseRows() {
  const r = rng(131)
  const out: Placement[] = []
  const add = (x: number, z: number) => out.push({ x: x + (r() - 0.5) * 0.08, z: z + (r() - 0.5) * 0.08, s: 0.95 + r() * 0.2, ry: r() * 6.28 })
  for (let z = GARDEN.plazaRadius + 1.2; z < GARDEN.gateZ - 1; z += 0.5) for (const side of [-1, 1]) add(pathX(z) + side * 1.6, z)
  for (let z = -GARDEN.plazaRadius - 1.2; z > HALL.frontZ + 1.6; z -= 0.5) for (const side of [-1, 1]) add(side * 1.6, z)
  return out
}

function tuftGeo() {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < 4; i++) {
    const g = new THREE.BufferGeometry()
    const a = (i / 4) * Math.PI + 0.3
    const w = 0.035
    const h = 0.22 + (i % 2) * 0.1
    const lean = 0.06
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-w * Math.cos(a), 0, -w * Math.sin(a), w * Math.cos(a), 0, w * Math.sin(a), lean * Math.sin(a), h, -lean * Math.cos(a)], 3),
    )
    const lo = new THREE.Color('#3E9A2C')
    const hi = new THREE.Color('#8BDB5E')
    g.setAttribute('color', new THREE.Float32BufferAttribute([lo.r, lo.g, lo.b, lo.r, lo.g, lo.b, hi.r, hi.g, hi.b], 3))
    parts.push(g)
  }
  const m = merge(parts)
  return m
}

function stoneGeo() {
  const g = new THREE.CylinderGeometry(1, 1, 0.12, 7, 1)
  return paint(wobble(g, 0.12, rng(5)), PALETTE.path, 0.06, rng(6))
}

function hedgeGeo() {
  const g = wobble(new THREE.BoxGeometry(3.3, 1.3, 1.25, 3, 2, 2), 0.14, rng(9))
  g.translate(0, 0.62, 0)
  return paint(g, PALETTE.hedge, 0.12, rng(10))
}

/* ---------- placement ---------- */

interface Placement {
  x: number
  z: number
  s: number
  ry: number
}

function scatterTrees(count: number): { deciduous: Placement[][]; conifer: Placement[] } {
  const r = rng(2024)
  const deciduous: Placement[][] = [[], []]
  const conifer: Placement[] = []
  const all: Placement[] = []
  let tries = 0
  while (all.length < count && tries++ < 5000) {
    const a = r() * Math.PI * 2
    const d = 9 + Math.sqrt(r()) * 28
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    if (onPath(x, z, 2.2) || inHouse(x, z, 1) || nearFeature(x, z, 3) || Math.hypot(x - GARDEN.spawn[0], z - GARDEN.spawn[2]) < 5) continue
    if (all.some((p) => Math.hypot(p.x - x, p.z - z) < 4.2)) continue
    const p = { x, z, s: 0.85 + r() * 0.5, ry: r() * Math.PI * 2 }
    all.push(p)
    const t = r()
    if (t < 0.25) conifer.push(p)
    else deciduous[t < 0.62 ? 0 : 1].push(p)
  }
  // a few framing trees near the entrance and the house
  const extra: Placement[] = [
    { x: -6, z: 30, s: 1.25, ry: 1 },
    { x: 6.5, z: 29, s: 1.1, ry: 2 },
    { x: -12, z: -16, s: 1.2, ry: 0.4 },
    { x: 12.5, z: -15, s: 1.3, ry: 1.4 },
  ]
  deciduous[0].push(...extra.slice(0, 2))
  deciduous[1].push(...extra.slice(2))
  return { deciduous, conifer }
}

function scatterTufts(count: number) {
  const r = rng(91)
  const out: Placement[] = []
  let tries = 0
  while (out.length < count && tries++ < count * 4) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * (GARDEN.radius - 1)
    const x = Math.cos(a) * d
    const z = Math.sin(a) * d
    if (onPath(x, z, 0.5) || inHouse(x, z, -2.5) || nearFeature(x, z, -0.4)) continue
    out.push({ x, z, s: 0.7 + r() * 0.9, ry: r() * 6.28 })
  }
  return out
}

function pathStones() {
  const r = rng(33)
  const out: Placement[] = []
  for (let z = GARDEN.plazaRadius + 0.6; z < GARDEN.gateZ + 1; z += 0.95) {
    const x = pathX(z)
    out.push({ x: x - 0.42 + (r() - 0.5) * 0.15, z: z + (r() - 0.5) * 0.2, s: 0.38 + r() * 0.1, ry: r() * 6 })
    out.push({ x: x + 0.45 + (r() - 0.5) * 0.15, z: z + 0.45 + (r() - 0.5) * 0.2, s: 0.36 + r() * 0.1, ry: r() * 6 })
  }
  for (let z = -GARDEN.plazaRadius - 0.6; z > HALL.frontZ + 0.4; z -= 0.95) {
    out.push({ x: -0.42 + (r() - 0.5) * 0.15, z, s: 0.38 + r() * 0.1, ry: r() * 6 })
    out.push({ x: 0.45 + (r() - 0.5) * 0.15, z: z - 0.45, s: 0.36 + r() * 0.1, ry: r() * 6 })
  }
  return out
}

function instanceRef(mesh: React.RefObject<THREE.InstancedMesh | null>, list: Placement[], y = 0, flatScale = false) {
  return (m: THREE.InstancedMesh | null) => {
    ;(mesh as React.MutableRefObject<THREE.InstancedMesh | null>).current = m
    if (!m) return
    const o = new THREE.Object3D()
    list.forEach((p, i) => {
      o.position.set(p.x, y, p.z)
      o.rotation.set(0, p.ry, 0)
      if (flatScale) o.scale.set(p.s, 1, p.s * (0.8 + ((i * 37) % 10) / 25))
      else o.scale.setScalar(p.s)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingSphere()
  }
}

/* ---------- components ---------- */

function Ground() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(190, 190, 110, 110)
    g.rotateX(-Math.PI / 2)
    const r = rng(4)
    const pos = g.attributes.position
    const col = new Float32Array(pos.count * 3)
    const a = new THREE.Color(PALETTE.grass)
    const b = new THREE.Color(PALETTE.grassDark)
    const c = new THREE.Color(PALETTE.grassLight)
    const tmp = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const n = Math.sin(x * 0.31 + Math.cos(z * 0.2)) * Math.cos(z * 0.27) * 0.5 + 0.5
      tmp.copy(a).lerp(n > 0.5 ? c : b, Math.abs(n - 0.5) * 1.1 + r() * 0.06)
      if (Math.hypot(x, z) > GARDEN.radius + 1.5) tmp.lerp(b, 0.3)
      col.set([tmp.r, tmp.g, tmp.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }, [])
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ vertexColors: true }), [])
  return <mesh geometry={geo} material={mat} receiveShadow position={[0, 0, 0]} />
}

function DistantHills() {
  const geo = useMemo(() => {
    const r = rng(55)
    const parts: THREE.BufferGeometry[] = []
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + r() * 0.1
      const d = 70 + r() * 15
      const g = wobble(new THREE.IcosahedronGeometry(9 + r() * 9, 1), 2.5, r)
      g.scale(1.6, 0.45 + r() * 0.25, 1)
      g.rotateY(-a)
      g.translate(Math.cos(a) * d, -1, Math.sin(a) * d)
      parts.push(paint(g, r() > 0.5 ? '#79C268' : '#68B25C', 0.06, r))
    }
    return merge(parts)
  }, [])
  const mat = useMemo(() => vertexMat({ fog: true }), [])
  return <mesh geometry={geo} material={mat} />
}

function Trees({ low }: { low: boolean }) {
  const data = useMemo(() => {
    const t = scatterTrees(low ? 30 : 46)
    return { ...t, geos: [deciduousGeo(1), deciduousGeo(7), coniferGeo(3)] }
  }, [low])
  const mat = useMemo(() => vertexMat(), [])
  const refs = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)]
  const lists = [data.deciduous[0], data.deciduous[1], data.conifer]
  const all = lists.flat()
  return (
    <>
      {lists.map((list, i) => (
        <instancedMesh
          key={i}
          ref={instanceRef(refs[i], list)}
          args={[data.geos[i], mat, list.length]}
          castShadow
          receiveShadow={false}
          frustumCulled={false}
        />
      ))}
      <RigidBody type="fixed" colliders={false}>
        {all.map((p, i) => (
          <CylinderCollider key={i} args={[1.4, 0.26 * p.s]} position={[p.x, 1.4, p.z]} />
        ))}
      </RigidBody>
    </>
  )
}

const windUniform = { value: 0 }

function windMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = windUniform
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float ph = instanceMatrix[3].x * 0.35 + instanceMatrix[3].z * 0.27;
          transformed.x += sin(uWind * 1.6 + ph) * 0.05 * position.y * 4.0;
          transformed.z += cos(uWind * 1.3 + ph) * 0.03 * position.y * 4.0;
        #endif`,
      )
  }
  return m
}

function Plants({ low }: { low: boolean }) {
  const reduced = useStore((s) => s.settings.reducedMotion)
  const roses = useMemo(() => roseRows(), [])
  const tufts = useMemo(() => scatterTufts(low ? 450 : 1300), [low])
  const rGeo = useMemo(() => roseGeo(), [])
  const tGeo = useMemo(() => tuftGeo(), [])
  const rMat = useMemo(() => windMaterial(), [])
  const tMat = useMemo(() => windMaterial(), [])
  const rRef = useRef<THREE.InstancedMesh>(null)
  const tRef = useRef<THREE.InstancedMesh>(null)
  useFrame((_, dt) => {
    if (!reduced) windUniform.value += dt
  })
  return (
    <>
      <instancedMesh ref={instanceRef(rRef, roses)} args={[rGeo, rMat, roses.length]} castShadow frustumCulled={false} />
      <instancedMesh ref={instanceRef(tRef, tufts)} args={[tGeo, tMat, tufts.length]} frustumCulled={false} />
    </>
  )
}

function Paths() {
  const stones = useMemo(() => pathStones(), [])
  const geo = useMemo(() => stoneGeo(), [])
  const mat = useMemo(() => vertexMat(), [])
  const ref = useRef<THREE.InstancedMesh>(null)
  // soft gravel ribbon under the stepping stones
  const ribbon = useMemo(() => {
    const pts: number[] = []
    const idx: number[] = []
    const w = 1.25
    let i = 0
    for (let z = GARDEN.plazaRadius - 0.5; z <= GARDEN.gateZ + 2; z += 0.6, i++) {
      const x = pathX(z)
      const ww = w + Math.sin(z * 1.7) * 0.08
      pts.push(x - ww, 0, z, x + ww, 0, z)
      if (i) idx.push((i - 1) * 2, i * 2, (i - 1) * 2 + 1, (i - 1) * 2 + 1, i * 2, i * 2 + 1)
    }
    const south = new THREE.BufferGeometry()
    south.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    south.setIndex(idx)
    const north = new THREE.PlaneGeometry(2.5, -HALL.frontZ - GARDEN.plazaRadius + 0.6)
    north.rotateX(-Math.PI / 2)
    north.translate(0, 0, (HALL.frontZ - GARDEN.plazaRadius) / 2 - 0.3)
    const plaza = new THREE.CircleGeometry(GARDEN.plazaRadius + 0.4, 40)
    plaza.rotateX(-Math.PI / 2)
    const parts = [south, north.toNonIndexed(), plaza.toNonIndexed()].map((g) => {
      const gg = g.index ? g.toNonIndexed() : g
      if (gg.attributes.uv) gg.deleteAttribute('uv')
      if (gg.attributes.normal) gg.deleteAttribute('normal')
      return gg
    })
    const m = merge(parts)
    return m
  }, [])
  const plazaGeo = useMemo(() => {
    // concentric paving rings on the plaza
    const r = rng(12)
    const parts: THREE.BufferGeometry[] = []
    for (let ring = 1; ring <= 3; ring++) {
      const rad = ring * 1.35
      const n = ring * 9
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2 + 0.02
        const a1 = ((k + 1) / n) * Math.PI * 2 - 0.02
        const g = new THREE.RingGeometry(rad - 1.3 + 0.06, rad - 0.04, 3, 1, a0, a1 - a0)
        g.rotateX(-Math.PI / 2)
        parts.push(paint(g, r() > 0.5 ? PALETTE.path : PALETTE.pathDark, 0.05, r))
      }
    }
    return merge(parts)
  }, [])
  return (
    <>
      <mesh geometry={ribbon} position={[0, 0.006, 0]} receiveShadow>
        <meshLambertMaterial color={'#E6D7B8'} />
      </mesh>
      <mesh geometry={plazaGeo} material={mat} position={[0, 0.012, 0]} receiveShadow />
      <instancedMesh ref={instanceRef(ref, stones, 0.02, true)} args={[geo, mat, stones.length]} receiveShadow frustumCulled={false} />
    </>
  )
}

function Hedges() {
  const list = useMemo(() => {
    const out: Placement[] = []
    const n = 92
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const x = Math.sin(a) * GARDEN.radius
      const z = Math.cos(a) * GARDEN.radius
      if (Math.abs(x) < 2.2 && z > 0) continue // the entrance gap
      out.push({ x, z, s: 1, ry: a + Math.PI / 2 })
    }
    return out
  }, [])
  const geo = useMemo(() => hedgeGeo(), [])
  const mat = useMemo(() => vertexMat(), [])
  const ref = useRef<THREE.InstancedMesh>(null)
  return (
    <>
      <instancedMesh ref={instanceRef(ref, list)} args={[geo, mat, list.length]} castShadow frustumCulled={false} />
      <RigidBody type="fixed" colliders={false}>
        {Array.from({ length: 48 }, (_, i) => {
          const a = (i / 48) * Math.PI * 2
          return (
            <CuboidCollider
              key={i}
              args={[2.8, 2, 0.6]}
              position={[Math.sin(a) * (GARDEN.radius + 0.2), 2, Math.cos(a) * (GARDEN.radius + 0.2)]}
              rotation={[0, a, 0]}
            />
          )
        })}
      </RigidBody>
    </>
  )
}

function Gate() {
  const wood = PALETTE.wood
  const z = GARDEN.radius
  const arch = useMemo(() => {
    const curve = new THREE.EllipseCurve(0, 0, 1.75, 0.9, 0, Math.PI, false, 0)
    const pts = curve.getPoints(14).map((p) => new THREE.Vector3(p.x, p.y, 0))
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.09, 6, false)
  }, [])
  const vines = useMemo(() => {
    const r = rng(19)
    const parts: THREE.BufferGeometry[] = []
    for (let i = 0; i < 26; i++) {
      const t = r() * Math.PI
      const g = wobble(new THREE.IcosahedronGeometry(0.18 + r() * 0.12, 0), 0.05, r)
      g.translate(Math.cos(t) * 1.75, 2.6 + Math.sin(t) * 0.9, (r() - 0.5) * 0.3)
      parts.push(paint(g, PALETTE.foliage[i % 4], 0.1, r))
      if (i % 3 === 0) {
        const f = new THREE.OctahedronGeometry(0.06, 0)
        f.translate(Math.cos(t) * 1.75, 2.6 + Math.sin(t) * 0.9 + 0.12, (r() - 0.5) * 0.4 + 0.15)
        parts.push(paint(f, PALETTE.flower))
      }
    }
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1
      const g = wobble(new THREE.IcosahedronGeometry(0.16 + r() * 0.1, 0), 0.05, r)
      g.translate(side * 1.75 + (r() - 0.5) * 0.2, 0.4 + r() * 2.2, (r() - 0.5) * 0.3)
      parts.push(paint(g, PALETTE.foliage[i % 4], 0.1, r))
    }
    return merge(parts)
  }, [])
  const mat = useMemo(() => vertexMat(), [])
  return (
    <group position={[0, 0, z]}>
      {[-1.75, 1.75].map((x) => (
        <mesh key={x} position={[x, 1.3, 0]} castShadow>
          <boxGeometry args={[0.2, 2.6, 0.2]} />
          <meshLambertMaterial color={wood} />
        </mesh>
      ))}
      <mesh geometry={arch} position={[0, 2.6, 0]} castShadow>
        <meshLambertMaterial color={wood} />
      </mesh>
      <mesh geometry={vines} material={mat} castShadow />
      {/* low closed gate behind the player: the garden is the whole world */}
      {[-0.85, 0.85].map((x) => (
        <group key={x} position={[x, 0, 0.35]}>
          {Array.from({ length: 5 }, (_, i) => (
            <mesh key={i} position={[(i - 2) * 0.3, 0.55, 0]}>
              <boxGeometry args={[0.08, 1.1, 0.05]} />
              <meshLambertMaterial color={'#EDE6DA'} />
            </mesh>
          ))}
          <mesh position={[0, 0.85, 0]}>
            <boxGeometry args={[1.5, 0.08, 0.06]} />
            <meshLambertMaterial color={'#EDE6DA'} />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[1.5, 0.08, 0.06]} />
            <meshLambertMaterial color={'#EDE6DA'} />
          </mesh>
        </group>
      ))}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.2, 2, 0.3]} position={[0, 2, 0.4]} />
        <CuboidCollider args={[0.15, 1.3, 0.15]} position={[-1.75, 1.3, 0]} />
        <CuboidCollider args={[0.15, 1.3, 0.15]} position={[1.75, 1.3, 0]} />
      </RigidBody>
    </group>
  )
}

function Lanterns() {
  const spots = useMemo(() => {
    const out: [number, number][] = []
    for (const z of [10, 18, 26, 34]) out.push([pathX(z) + (z % 16 === 2 ? 2.4 : -2.4), z])
    out.push([-2.5, -12], [2.5, -12])
    return out
  }, [])
  return (
    <>
      {spots.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.7, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.05, 1.4, 6]} />
            <meshLambertMaterial color={'#6F6A63'} />
          </mesh>
          <mesh position={[0, 1.5, 0]}>
            <boxGeometry args={[0.24, 0.3, 0.24]} />
            <meshLambertMaterial color={'#FFF1D6'} emissive={'#FFE2B0'} emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[0, 1.7, 0]}>
            <coneGeometry args={[0.22, 0.16, 4]} />
            <meshLambertMaterial color={'#6F6A63'} />
          </mesh>
        </group>
      ))}
      <RigidBody type="fixed" colliders={false}>
        {spots.map(([x, z], i) => (
          <CylinderCollider key={i} args={[0.8, 0.12]} position={[x, 0.8, z]} />
        ))}
      </RigidBody>
    </>
  )
}

export function Garden() {
  const low = useStore((s) => s.settings.quality === 'low')
  return (
    <group>
      <Ground />
      <DistantHills />
      <Paths />
      <Trees low={low} />
      <Plants low={low} />
      <Hedges />
      <Gate />
      <HeartBenches />
      <Fountain />
      <HeartTree />
      <Lanterns />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[100, 0.5, 100]} position={[0, -0.5, 0]} />
      </RigidBody>
    </group>
  )
}
