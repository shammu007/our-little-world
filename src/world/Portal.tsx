import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { HALL } from '../lib/layout'
import { live, useStore } from '../state/store'
import { registerInteractable } from './interactions'
import { glowTexture } from './textures'

const R = HALL.portalRadius
const Z = HALL.backZ + HALL.wallThickness / 2 + 0.06

const swirlShader = {
  uniforms: { uTime: { value: 0 }, uNear: { value: 0 }, uOpen: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    varying vec2 vUv; uniform float uTime; uniform float uNear; uniform float uOpen;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
    void main(){
      vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
      float a = atan(p.y, p.x);
      float speed = 0.35 + uNear * 0.5 + uOpen * 3.0;
      float sw = a + r * 4.0 - uTime * speed;
      float n = noise(vec2(cos(sw), sin(sw)) * 2.2 + r * 3.0 + uTime * 0.2);
      float bands = 0.5 + 0.5 * sin(sw * 3.0 + n * 4.0);
      vec3 deep = vec3(0.02, 0.12, 0.35);
      vec3 blue = vec3(0.15, 0.6, 1.0);
      vec3 col = mix(deep, blue, bands * (0.45 + 0.55 * (1.0 - r)));
      col += vec3(0.6, 0.85, 1.0) * pow(1.0 - r, 3.0) * (0.25 + uNear * 0.6);
      col = mix(col, vec3(1.0), uOpen * smoothstep(0.9, 0.0, r) * 0.85);
      float alpha = smoothstep(1.0, 0.86, r) * (0.55 + uNear * 0.35 + uOpen * 0.3);
      gl_FragColor = vec4(col, alpha);
    }`,
}

export function Portal() {
  const portalSeq = useStore((s) => s.portalSeq)
  const reduced = useStore((s) => s.settings.reducedMotion)
  const ring = useRef<THREE.Mesh>(null)
  const dashes = useRef<THREE.Group>(null)
  const halo = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const group = useRef<THREE.Group>(null)
  const open = useRef(0)
  const near = useRef(0)
  const mat = useMemo(() => new THREE.ShaderMaterial({ ...swirlShader, uniforms: THREE.UniformsUtils.clone(swirlShader.uniforms), transparent: true, depthWrite: false }), [])
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color('#2F9BFF'), toneMapped: false }), [])
  const haloMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#3FA6FF', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    [],
  )

  useEffect(
    () =>
      registerInteractable({
        id: 'portal',
        kind: 'portal',
        label: 'Touch the portal',
        position: [0, 0, HALL.backZ + 1.7],
        radius: 3.4,
      }),
    [],
  )

  useEffect(() => {
    if (portalSeq) open.current = 0.0001
  }, [portalSeq])

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const p = live.playerPos
    const d = Math.hypot(p[0], p[2] - (HALL.backZ + 1))
    const target = THREE.MathUtils.clamp(1 - (d - 1.5) / 6.5, 0, 1)
    near.current += (target - near.current) * Math.min(1, dt * 3)
    const n = near.current
    let o = 0
    if (open.current > 0) {
      open.current += dt / 2.6
      o = Math.sin(Math.min(1, open.current) * Math.PI)
      if (open.current >= 1) open.current = 0
    }
    mat.uniforms.uTime.value = reduced ? t * 0.3 : t
    mat.uniforms.uNear.value = n
    mat.uniforms.uOpen.value = o
    const pulse = reduced ? 0 : Math.sin(t * 2.2) * 0.04
    ringMat.color.setRGB(0.18 + n * 0.25 + o * 0.6, 0.6 + n * 0.3 + o * 0.4, 1).multiplyScalar(1 + n * 0.8 + o * 1.5)
    if (halo.current) {
      const s = 1 + n * 0.25 + o * 0.6 + pulse
      halo.current.scale.setScalar(s)
      haloMat.opacity = 0.22 + n * 0.38 + o * 0.5
    }
    if (dashes.current) dashes.current.rotation.z += dt * (reduced ? 0.05 : 0.25 + n * 0.4 + o * 4)
    if (group.current) group.current.scale.setScalar(1 + o * 0.12)
    if (light.current) light.current.intensity = 1.2 + n * 3 + o * 8
  })

  const dashGeo = useMemo(() => new THREE.BoxGeometry(0.16, 0.035, 0.02), [])
  return (
    <group position={[0, HALL.portalCenterY, Z]}>
      <mesh ref={halo} material={haloMat} position={[0, 0, -0.03]}>
        <planeGeometry args={[R * 4.2, R * 4.2]} />
      </mesh>
      <group ref={group}>
        <mesh material={mat}>
          <circleGeometry args={[R, 64]} />
        </mesh>
        <mesh ref={ring} material={ringMat}>
          <torusGeometry args={[R, 0.06, 12, 96]} />
        </mesh>
        <mesh material={ringMat}>
          <torusGeometry args={[R + 0.16, 0.012, 6, 96]} />
        </mesh>
        <group ref={dashes}>
          {Array.from({ length: 28 }, (_, i) => {
            const a = (i / 28) * Math.PI * 2
            return <mesh key={i} geometry={dashGeo} material={ringMat} position={[Math.cos(a) * (R + 0.3), Math.sin(a) * (R + 0.3), 0]} rotation={[0, 0, a + Math.PI / 2]} />
          })}
        </group>
      </group>
      <pointLight ref={light} position={[0, 0, 0.8]} color={'#3C9DFF'} distance={6} decay={1.5} intensity={1.5} />
    </group>
  )
}
