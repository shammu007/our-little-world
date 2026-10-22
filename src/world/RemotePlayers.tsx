import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { content } from '../content/content'
import { remoteBuffers } from '../net/room'
import { useStore, type RemoteInfo } from '../state/store'
import { AvatarModel, type AvatarMotion } from './Avatar'
import { labelTexture } from './textures'

function RemoteAvatar({ info }: { info: RemoteInfo }) {
  const group = useRef<THREE.Group>(null)
  const motion = useRef<AvatarMotion>({ anim: 'idle', speed: 0 })
  const look = content.roles[info.role].avatar
  const label = useMemo(() => labelTexture(info.name), [info.name])
  const fade = useRef(0)
  useEffect(() => () => label.dispose(), [label])
  useFrame((_, dt) => {
    const g = group.current
    const buf = remoteBuffers.get(info.sessionId)
    if (!g || !buf) return
    const s = buf.sample(performance.now())
    if (!s) {
      g.visible = false
      return
    }
    g.visible = true
    g.position.set(s.p[0], s.p[1], s.p[2])
    g.rotation.y = s.yaw
    motion.current.anim = s.anim
    motion.current.speed = s.speed
    fade.current = Math.min(1, fade.current + dt * 2)
    g.scale.setScalar(0.6 + 0.4 * fade.current)
  })
  return (
    <group ref={group} visible={false}>
      <AvatarModel look={look} motion={motion} />
      <sprite position={[0, 1.85, 0]} scale={[0.9, 0.225, 1]}>
        <spriteMaterial map={label} transparent depthWrite={false} />
      </sprite>
    </group>
  )
}

export function RemotePlayers() {
  const remotes = useStore((s) => s.remotes)
  return (
    <>
      {remotes.map((r) => (
        <RemoteAvatar key={r.sessionId} info={r} />
      ))}
    </>
  )
}
