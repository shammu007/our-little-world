import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { CylinderCollider, RigidBody } from '@react-three/rapier'
import { content } from '../content/content'
import { useStore } from '../state/store'
import { glowTexture, textTexture } from './textures'
import { merge, paint, rng } from './util'
import { registerInteractable } from './interactions'
import { CANDLE_COUNT, PEDESTAL_H, TIERS, candlePositions, tierBase } from '../lib/cake'

const SPRINKLES = ['#FF8A3D', '#FF5E8A', '#FFFFFF', '#5BC0F5', '#FFD23F']

function cakeGeometry() {
  const r = rng(25)
  const parts: THREE.BufferGeometry[] = []
  // stone pedestal
  const ped = new THREE.CylinderGeometry(1.55, 1.7, PEDESTAL_H - 0.06, 28)
  ped.translate(0, (PEDESTAL_H - 0.06) / 2, 0)
  parts.push(paint(ped, '#F3F0EA', 0.02, r))
  const plate = new THREE.CylinderGeometry(1.45, 1.45, 0.06, 40)
  plate.translate(0, PEDESTAL_H - 0.03, 0)
  parts.push(paint(plate, '#FBFAF7'))

  TIERS.forEach((t, i) => {
    const y0 = tierBase(i)
    const body = new THREE.CylinderGeometry(t.r, t.r, t.h, 40, 1)
    body.translate(0, y0 + t.h / 2, 0)
    parts.push(paint(body, t.sponge, 0.01, r))
    // drips along the top edge
    const n = Math.round(t.r * 26)
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2
      const len = 0.08 + r() * 0.2
      const d = new THREE.CapsuleGeometry(0.045, len, 3, 6)
      d.translate(Math.cos(a) * (t.r + 0.01), y0 + t.h - len / 2 - 0.02, Math.sin(a) * (t.r + 0.01))
      parts.push(paint(d, t.drip))
    }
    const cap = new THREE.CylinderGeometry(t.r + 0.015, t.r + 0.015, 0.05, 40)
    cap.translate(0, y0 + t.h - 0.02, 0)
    parts.push(paint(cap, t.drip))
    // pearl piping around the base and the top
    const beads = Math.round(t.r * 30)
    for (let k = 0; k < beads; k++) {
      const a = (k / beads) * Math.PI * 2
      const s = new THREE.SphereGeometry(0.05, 8, 6)
      s.translate(Math.cos(a) * t.r, y0 + 0.04, Math.sin(a) * t.r)
      parts.push(paint(s, t.bead))
      if (k % 2 === 0) {
        const s2 = new THREE.SphereGeometry(0.035, 8, 6)
        s2.translate(Math.cos(a) * (t.r - 0.06), y0 + t.h + 0.02, Math.sin(a) * (t.r - 0.06))
        parts.push(paint(s2, t.bead))
      }
    }
    // candy dots on the sides
    const dots = Math.round(t.r * 22)
    for (let k = 0; k < dots; k++) {
      const a = (k / dots) * Math.PI * 2 + i * 0.7 + r() * 0.2
      const y = y0 + 0.16 + r() * (t.h - 0.45)
      const d = new THREE.SphereGeometry(0.038, 6, 4)
      d.scale(0.6, 1, 1)
      d.rotateY(-a)
      d.translate(Math.cos(a) * (t.r + 0.005), y, Math.sin(a) * (t.r + 0.005))
      parts.push(paint(d, SPRINKLES[(k + i) % SPRINKLES.length]))
    }
  })
  // berries and little leaves on top
  const topY = tierBase(3)
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + 0.3
    const b = new THREE.SphereGeometry(0.06, 10, 8)
    b.translate(Math.cos(a) * 0.45, topY + 0.04, Math.sin(a) * 0.45)
    parts.push(paint(b, k % 2 ? '#E0202C' : '#F2394A'))
    const leaf = new THREE.SphereGeometry(0.05, 6, 4)
    leaf.scale(1.6, 0.3, 0.7)
    leaf.rotateY(-a + 0.6)
    leaf.translate(Math.cos(a + 0.22) * 0.46, topY + 0.03, Math.sin(a + 0.22) * 0.46)
    parts.push(paint(leaf, '#4CAF3C'))
  }
  // a few berries on the lower ledges between candles
  for (const [lvl, rr, n] of [
    [1, 1.0, 13],
    [2, 0.66, 8],
  ] as const) {
    for (let k = 0; k < n; k++) {
      const a = ((k + 0.5) / n) * Math.PI * 2 + (lvl - 1) * 0.4
      const b = new THREE.SphereGeometry(0.045, 8, 6)
      b.translate(Math.cos(a) * rr, tierBase(lvl) + 0.03, Math.sin(a) * rr)
      parts.push(paint(b, '#F2394A'))
    }
  }
  return merge(parts.map((g) => (g.attributes.uv ? (g.deleteAttribute('uv'), g) : g)))
}

/* Soft additive point sprites with per-point alpha & size. */
function softPointsMaterial(color: THREE.ColorRepresentation, additive = true) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { map: { value: glowTexture() }, color: { value: new THREE.Color(color) }, scale: { value: 600 } },
    vertexShader: `attribute float alpha; attribute float size; varying float vA; uniform float scale;
      void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 color; varying float vA;
      void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(color, t.a * vA); if (gl_FragColor.a < 0.01) discard; }`,
  })
}

const STICK_COLORS = ['#FF8FB1', '#7FD3F7', '#FFD45E', '#9BE38B', '#C9A4F5']

function Candles() {
  const positions = useMemo(() => candlePositions(), [])
  const cakeOut = useStore((s) => s.cake.out)
  const reduced = useStore((s) => s.settings.reducedMotion)
  const sticks = useRef<THREE.InstancedMesh>(null)
  const flames = useRef<THREE.InstancedMesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const lit = useRef(new Float32Array(CANDLE_COUNT).fill(1))
  const delays = useRef(new Float32Array(CANDLE_COUNT))
  const smokeT = useRef(new Float32Array(CANDLE_COUNT).fill(-1))

  const stickGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.028, 0.028, 0.26, 10)
    g.translate(0, 0.13, 0)
    const wick = new THREE.CylinderGeometry(0.004, 0.004, 0.04, 4)
    wick.translate(0, 0.28, 0)
    const a = paint(g, '#ffffff')
    const b = paint(wick, '#5a4a3e')
    return merge([a, b])
  }, [])
  const flameGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(0.028, 10, 8)
    g.scale(1, 2.1, 1)
    g.translate(0, 0.045, 0)
    return g
  }, [])

  const halo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const p = new Float32Array(CANDLE_COUNT * 3)
    positions.forEach((v, i) => p.set([v[0], v[1] + 0.33, v[2]], i * 3))
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(CANDLE_COUNT).fill(1), 1))
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(CANDLE_COUNT).fill(0.28), 1))
    return g
  }, [positions])
  const smoke = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CANDLE_COUNT * 3), 3))
    g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(CANDLE_COUNT), 1))
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(CANDLE_COUNT).fill(0.2), 1))
    return g
  }, [])
  const haloMat = useMemo(() => softPointsMaterial('#FFC46B'), [])
  const smokeMat = useMemo(() => softPointsMaterial('#B9B6B0', false), [])

  useEffect(() => {
    const m = sticks.current
    if (!m) return
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    positions.forEach((p, i) => {
      o.position.set(p[0], p[1], p[2])
      o.rotation.set((Math.sin(i * 7.1) * 0.04), 0, Math.cos(i * 3.3) * 0.04)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c.set(STICK_COLORS[i % STICK_COLORS.length]))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [positions])

  // schedule extinguish / relight sequence whenever the shared state flips
  useEffect(() => {
    const order = Array.from({ length: CANDLE_COUNT }, (_, i) => i).sort(() => Math.random() - 0.5)
    order.forEach((ci, k) => (delays.current[ci] = k * (cakeOut ? 0.035 : 0.05)))
  }, [cakeOut])

  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const fl = flames.current
    if (!fl) return
    const alpha = halo.attributes.alpha as THREE.BufferAttribute
    const sp = smoke.attributes.position as THREE.BufferAttribute
    const sa = smoke.attributes.alpha as THREE.BufferAttribute
    let total = 0
    for (let i = 0; i < CANDLE_COUNT; i++) {
      if (delays.current[i] > 0) delays.current[i] -= dt
      else {
        const target = cakeOut ? 0 : 1
        const before = lit.current[i]
        lit.current[i] += (target - lit.current[i]) * Math.min(1, dt * (cakeOut ? 14 : 6))
        if (cakeOut && before > 0.5 && lit.current[i] <= 0.5) smokeT.current[i] = 0
      }
      const l = lit.current[i]
      total += l
      const p = positions[i]
      const flick = reduced ? 1 : 0.88 + Math.sin(t * 13 + i * 1.7) * 0.07 + Math.sin(t * 23 + i) * 0.05
      o.position.set(p[0] + (reduced ? 0 : Math.sin(t * 5 + i) * 0.004), p[1] + 0.29, p[2])
      o.scale.set(l * (0.9 + (1 - flick)), l * flick, l * (0.9 + (1 - flick)))
      o.updateMatrix()
      fl.setMatrixAt(i, o.matrix)
      alpha.setX(i, l * flick * 0.85)
      // smoke wisps rise and fade after a candle goes out
      const st = smokeT.current[i]
      if (st >= 0) {
        const nt = st + dt
        smokeT.current[i] = nt > 2.2 ? -1 : nt
        sp.setXYZ(i, p[0] + Math.sin(nt * 3 + i) * 0.04 * nt, p[1] + 0.33 + nt * 0.35, p[2])
        sa.setX(i, Math.max(0, 0.55 * (1 - nt / 2.2)))
      } else sa.setX(i, 0)
    }
    fl.instanceMatrix.needsUpdate = true
    alpha.needsUpdate = true
    sp.needsUpdate = true
    sa.needsUpdate = true
    if (light.current) light.current.intensity = (total / CANDLE_COUNT) * (reduced ? 2.2 : 2 + Math.sin(t * 9) * 0.25)
  })

  return (
    <group>
      <instancedMesh ref={sticks} args={[stickGeo, undefined, CANDLE_COUNT]} castShadow={false}>
        <meshLambertMaterial vertexColors />
      </instancedMesh>
      <instancedMesh ref={flames} args={[flameGeo, undefined, CANDLE_COUNT]} frustumCulled={false}>
        <meshBasicMaterial color={'#FFD58A'} toneMapped={false} />
      </instancedMesh>
      <points geometry={halo} material={haloMat} frustumCulled={false} />
      <points geometry={smoke} material={smokeMat} frustumCulled={false} />
      <pointLight ref={light} position={[0, 2.7, 0]} color={'#FFC98A'} distance={7} decay={1.6} intensity={2} />
    </group>
  )
}

const CONFETTI = 150
const CONFETTI_COLORS = ['#FF5E8A', '#5BC0F5', '#FFD23F', '#7ED957', '#FFFFFF', '#C69CF5']

function Confetti() {
  const blowSeq = useStore((s) => s.blowSeq)
  const reduced = useStore((s) => s.settings.reducedMotion)
  const ref = useRef<THREE.InstancedMesh>(null)
  const sim = useRef<{ p: Float32Array; v: Float32Array; r: Float32Array; life: number; count: number }>({
    p: new Float32Array(CONFETTI * 3),
    v: new Float32Array(CONFETTI * 3),
    r: new Float32Array(CONFETTI * 3),
    life: -1,
    count: 0,
  })
  const geo = useMemo(() => new THREE.PlaneGeometry(0.055, 0.09), [])
  const o = useMemo(() => new THREE.Object3D(), [])

  useEffect(() => {
    const m = ref.current
    if (!m) return
    const c = new THREE.Color()
    for (let i = 0; i < CONFETTI; i++) m.setColorAt(i, c.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length]))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [])

  useEffect(() => {
    if (!blowSeq) return
    const s = sim.current
    s.count = reduced ? 40 : CONFETTI
    s.life = 0
    for (let i = 0; i < s.count; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 1.2 + Math.random() * 2.2
      s.p.set([Math.cos(a) * 0.3, 2.6, Math.sin(a) * 0.3], i * 3)
      s.v.set([Math.cos(a) * sp, (reduced ? 2 : 3.6) + Math.random() * 2.4, Math.sin(a) * sp], i * 3)
      s.r.set([Math.random() * 6, Math.random() * 6, Math.random() * 6], i * 3)
    }
  }, [blowSeq, reduced])

  useFrame((_, dtRaw) => {
    const m = ref.current
    const s = sim.current
    if (!m) return
    if (s.life < 0) {
      if (m.count !== 0) m.count = 0
      return
    }
    const dt = Math.min(dtRaw, 0.05)
    s.life += dt
    const fade = Math.max(0, 1 - Math.max(0, s.life - 3.2) / 1.2)
    m.count = s.count
    for (let i = 0; i < s.count; i++) {
      const k = i * 3
      s.v[k + 1] -= 4.2 * dt
      const drag = Math.pow(0.975, dt * 60)
      s.v[k] *= drag
      s.v[k + 2] *= drag
      if (s.v[k + 1] < -1.1) s.v[k + 1] = -1.1 // flutter down gently
      s.p[k] += s.v[k] * dt
      s.p[k + 1] = Math.max(0.03, s.p[k + 1] + s.v[k + 1] * dt)
      s.p[k + 2] += s.v[k + 2] * dt
      if (!reduced) {
        s.r[k] += dt * 5
        s.r[k + 1] += dt * 3
      }
      o.position.set(s.p[k], s.p[k + 1], s.p[k + 2])
      o.rotation.set(s.r[k], s.r[k + 1], s.r[k + 2])
      o.scale.setScalar(fade)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    }
    m.instanceMatrix.needsUpdate = true
    if (fade <= 0) s.life = -1
  })

  return (
    <instancedMesh ref={ref} args={[geo, undefined, CONFETTI]} frustumCulled={false}>
      <meshLambertMaterial side={THREE.DoubleSide} />
    </instancedMesh>
  )
}

function Sign() {
  const tex = useRef<THREE.Texture | null>(null)
  const mat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#F6F0E4' }), [])
  useEffect(() => {
    let alive = true
    textTexture(content.signText, { w: 1024, h: 400, size: 150, color: '#6A4E3C', bg: '#F6F0E4' }).then((t) => {
      if (!alive) return t.dispose()
      tex.current = t
      mat.map = t
      mat.color.set('#ffffff')
      mat.needsUpdate = true
    })
    return () => {
      alive = false
      tex.current?.dispose()
    }
  }, [mat])
  const wood = '#A88466'
  return (
    <group position={[2.9, 0, 4.3]} rotation={[0, -0.55, 0]}>
      {[-0.8, 0.8].map((x) => (
        <mesh key={x} position={[x, 0.65, -0.03]} castShadow>
          <boxGeometry args={[0.1, 1.3, 0.1]} />
          <meshLambertMaterial color={wood} />
        </mesh>
      ))}
      <mesh position={[0, 1.15, 0]} castShadow>
        <boxGeometry args={[1.95, 0.82, 0.07]} />
        <meshLambertMaterial color={wood} />
      </mesh>
      <mesh position={[0, 1.15, 0.037]} material={mat}>
        <planeGeometry args={[1.8, 0.7]} />
      </mesh>
      <mesh position={[0, 1.15, -0.037]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1.8, 0.7]} />
        <meshLambertMaterial color={'#EFE7D8'} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.7, 0.2]} position={[-0.8, 0.7, 0]} />
        <CylinderCollider args={[0.7, 0.2]} position={[0.8, 0.7, 0]} />
      </RigidBody>
    </group>
  )
}

/** A floating line of text above the cake that always faces the camera. */
function WishText() {
  const reduced = useStore((s) => s.settings.reducedMotion)
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false }), [])
  useEffect(() => {
    if (!content.wishText) return
    let alive = true
    let tex: THREE.Texture | null = null
    textTexture(content.wishText, { w: 1600, h: 260, size: 140, color: '#FFFFFF', stroke: '#4A3A6A', sparkles: true }).then((t) => {
      if (!alive) return t.dispose()
      tex = t
      mat.map = t
      mat.opacity = 1
      mat.needsUpdate = true
    })
    return () => {
      alive = false
      tex?.dispose()
    }
  }, [mat])
  useFrame((state) => {
    const m = ref.current
    if (!m) return
    m.quaternion.copy(state.camera.quaternion)
    m.position.y = 3.75 + (reduced ? 0 : Math.sin(state.clock.elapsedTime * 1.4) * 0.08)
  })
  if (!content.wishText) return null
  return (
    <mesh ref={ref} material={mat} position={[0, 3.75, 0]} renderOrder={5}>
      <planeGeometry args={[5.2, 0.85]} />
    </mesh>
  )
}

export function Cake() {
  const geo = useMemo(() => cakeGeometry(), [])
  useEffect(
    () =>
      registerInteractable({
        id: 'cake',
        kind: 'cake',
        label: 'Make a wish',
        position: [0, 0, 0],
        radius: 4.4,
      }),
    [],
  )
  return (
    <group>
      <mesh geometry={geo} castShadow receiveShadow>
        <meshLambertMaterial vertexColors />
      </mesh>
      <Candles />
      <Confetti />
      <Sign />
      <WishText />
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1.2, 1.75]} position={[0, 1.2, 0]} />
      </RigidBody>
    </group>
  )
}
