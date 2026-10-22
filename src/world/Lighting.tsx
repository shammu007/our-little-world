import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { live, useStore } from '../state/store'

const SUN_DIR = new THREE.Vector3(-0.45, 1, 0.55).normalize()

function Sky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color('#B9D3E3') }, horizon: { value: new THREE.Color('#EEF1EA') }, sunDir: { value: SUN_DIR } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vDir;
          void main(){ float h = clamp(vDir.y, 0.0, 1.0); vec3 c = mix(horizon, top, pow(h, 0.6));
          float s = max(dot(normalize(vDir), sunDir), 0.0); c += vec3(1.0,0.95,0.85) * pow(s, 60.0) * 0.6 + vec3(1.0,0.97,0.9) * pow(s, 6.0) * 0.12;
          gl_FragColor = vec4(c, 1.0); }`,
      }),
    [],
  )
  // soft drifting clouds made of flattened blobs
  const clouds = useMemo(() => {
    const out: { p: [number, number, number]; s: number }[] = []
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3
      out.push({ p: [Math.cos(a) * 85, 32 + (i % 3) * 6, Math.sin(a) * 85], s: 6 + (i % 4) * 2 })
    }
    return out
  }, [])
  const group = useRef<THREE.Group>(null)
  const reduced = useStore((s) => s.settings.reducedMotion)
  useFrame((_, dt) => {
    if (group.current && !reduced) group.current.rotation.y += dt * 0.004
  })
  return (
    <>
      <mesh material={mat} scale={150} frustumCulled={false}>
        <sphereGeometry args={[1, 32, 16]} />
      </mesh>
      <group ref={group}>
        {clouds.map((c, i) => (
          <group key={i} position={c.p} scale={c.s}>
            {[0, 1, 2].map((k) => (
              <mesh key={k} position={[(k - 1) * 1.1, k === 1 ? 0.3 : 0, 0]} scale={[1.2, 0.55, 0.8]}>
                <icosahedronGeometry args={[1, 1]} />
                <meshBasicMaterial color={'#FBFBF8'} fog={false} transparent opacity={0.9} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </>
  )
}

export function Lighting() {
  const sun = useRef<THREE.DirectionalLight>(null)
  const quality = useStore((s) => s.settings.quality)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    scene.fog = new THREE.Fog('#E9EDE4', 45, 135)
    scene.background = new THREE.Color('#E9EDE4')
  }, [scene])
  useEffect(() => {
    if (sun.current) scene.add(sun.current.target)
  }, [scene])
  useFrame(() => {
    const s = sun.current
    if (!s) return
    const [x, , z] = live.playerPos
    // snap to texel-ish steps to avoid shadow shimmering
    const sx = Math.round(x / 2) * 2
    const sz = Math.round(z / 2) * 2
    s.position.set(sx + SUN_DIR.x * 40, SUN_DIR.y * 40, sz + SUN_DIR.z * 40)
    s.target.position.set(sx, 0, sz)
  })
  const shadows = quality === 'high'
  return (
    <>
      <Sky />
      <hemisphereLight args={['#EEF3F6', '#A9AE8F', 1.35]} />
      <ambientLight intensity={0.25} color={'#FFF8EE'} />
      <directionalLight
        ref={sun}
        color={'#FFF3E2'}
        intensity={1.9}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-near={5}
        shadow-camera-far={90}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
    </>
  )
}
