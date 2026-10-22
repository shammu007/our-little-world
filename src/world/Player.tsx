import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier'
import type { KinematicCharacterController } from '@dimforge/rapier3d-compat'
import { input, moveVector } from '../input/input'
import { room } from '../net/room'
import { live, useStore } from '../state/store'
import type { AnimState, AvatarLook } from '../types'
import { AvatarModel, type AvatarMotion } from './Avatar'
import { GARDEN } from './Garden'
import { findFocus } from './interactions'

const WALK = 3.3
const RUN = 6
const GRAVITY = 22
const JUMP = 6.8
const PIVOT_H = 1.3
const CAM = { minDist: 1.6, maxDist: 8, minPitch: -0.25, maxPitch: 1.15 }

/** Camera state shared with touch / mouse handlers. */
export const cam = { yaw: Math.PI, pitch: 0.32, dist: 4.6, actualDist: 4.6, intro: 0 }

export function Player({ look }: { look: AvatarLook }) {
  const body = useRef<RapierRigidBody>(null)
  const visual = useRef<THREE.Group>(null)
  const { world, rapier } = useRapier()
  const camera = useThree((s) => s.camera)
  const controller = useRef<KinematicCharacterController | null>(null)
  const velY = useRef(0)
  const hVel = useRef(new THREE.Vector2())
  const yaw = useRef(live.playerYaw)
  const grounded = useRef(true)
  const motion = useRef<AvatarMotion>({ anim: 'idle', speed: 0 })
  const focusTimer = useRef(0)
  const camPos = useRef(new THREE.Vector3())
  const camTarget = useRef(new THREE.Vector3())
  const firstFrame = useRef(true)
  const reduced = useStore((s) => s.settings.reducedMotion)

  useEffect(() => {
    const c = world.createCharacterController(0.03)
    c.setUp({ x: 0, y: 1, z: 0 })
    c.setSlideEnabled(true)
    c.enableAutostep(0.32, 0.15, true)
    c.enableSnapToGround(0.35)
    c.setMaxSlopeClimbAngle((50 * Math.PI) / 180)
    c.setApplyImpulsesToDynamicBodies(false)
    controller.current = c
    if (useStore.getState().phase !== 'playing') {
      cam.yaw = live.playerYaw
      cam.pitch = 0.32
      cam.dist = 4.6
      cam.actualDist = 4.6
      cam.intro = reduced ? 1 : 0
    } else cam.intro = 1
    return () => {
      world.removeCharacterController(c)
      controller.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world])

  useFrame((_, dtRaw) => {
    const rb = body.current
    const ctrl = controller.current
    if (!rb || !ctrl) return
    const dt = Math.min(dtRaw, 0.1) // shape-cast controller: no tunnelling even on slow frames
    const s = useStore.getState()
    const canMove = s.phase === 'playing' && !s.overlay && !s.superseded
    const collider = rb.collider(0)
    if (!collider) return

    // ---- camera input ----
    cam.yaw -= input.look.dx
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + input.look.dy, CAM.minPitch, CAM.maxPitch)
    input.look.dx = input.look.dy = 0
    if (input.zoom) {
      cam.dist = THREE.MathUtils.clamp(cam.dist + input.zoom, CAM.minDist, CAM.maxDist)
      input.zoom = 0
    }

    // ---- movement ----
    const mv = canMove ? moveVector() : { x: 0, y: 0, run: false }
    const fx = Math.sin(cam.yaw)
    const fz = Math.cos(cam.yaw)
    const dirX = fx * mv.y - fz * mv.x
    const dirZ = fz * mv.y + fx * mv.x
    const mag = Math.min(1, Math.hypot(mv.x, mv.y))
    const speed = (mv.run ? RUN : WALK) * mag
    const tx = mag > 0.01 ? (dirX / Math.hypot(dirX, dirZ)) * speed : 0
    const tz = mag > 0.01 ? (dirZ / Math.hypot(dirX, dirZ)) * speed : 0
    const accel = Math.min(1, dt * (mag > 0.01 ? 10 : 12))
    hVel.current.x += (tx - hVel.current.x) * accel
    hVel.current.y += (tz - hVel.current.y) * accel

    if (grounded.current) {
      if (input.jump && canMove) velY.current = JUMP
      else if (velY.current < 0) velY.current = -1
    }
    input.jump = false
    velY.current -= GRAVITY * dt

    const desired = { x: hVel.current.x * dt, y: velY.current * dt, z: hVel.current.y * dt }
    ctrl.computeColliderMovement(collider, desired)
    const m = ctrl.computedMovement()
    grounded.current = ctrl.computedGrounded()
    if (grounded.current && velY.current < 0) velY.current = 0
    if (live.teleport) {
      const tp = live.teleport
      live.teleport = null
      rb.setTranslation({ x: tp.x, y: 0.8, z: tp.z }, true)
      yaw.current = tp.yaw
      cam.yaw = tp.camYaw ?? tp.yaw
      cam.intro = 1
      hVel.current.set(0, 0)
      firstFrame.current = true
      return
    }
    const t = rb.translation()
    let nx = t.x + m.x
    let ny = t.y + m.y
    let nz = t.z + m.z
    if (ny < -8) {
      ;[nx, ny, nz] = GARDEN.spawn
      velY.current = 0
    }
    rb.setNextKinematicTranslation({ x: nx, y: ny, z: nz })

    const hs = Math.hypot(m.x, m.z) / dt
    if (hs > 0.3) {
      const targetYaw = Math.atan2(m.x, m.z)
      let d = targetYaw - yaw.current
      d = Math.atan2(Math.sin(d), Math.cos(d))
      yaw.current += d * Math.min(1, dt * 12)
    }
    const anim: AnimState = !grounded.current && Math.abs(velY.current) > 1.5 ? 'jump' : hs > 4.4 ? 'run' : hs > 0.35 ? 'walk' : 'idle'
    motion.current.anim = anim
    motion.current.speed = hs

    // feet sit at capsule bottom (half height 0.45 + radius 0.3)
    const feetY = ny - 0.75
    live.playerPos = [nx, feetY, nz]
    live.playerYaw = yaw.current
    if (visual.current) {
      visual.current.position.set(nx, feetY, nz)
      visual.current.rotation.y = yaw.current
    }
    room.publishPose([nx, feetY, nz], yaw.current, anim, hs)

    // ---- interaction focus (10 Hz) ----
    focusTimer.current -= dt
    if (focusTimer.current <= 0) {
      focusTimer.current = 0.1
      s.setFocus(canMove || s.overlay ? findFocus(live.playerPos, yaw.current) : null)
    }

    // ---- third-person camera with collision ----
    if (cam.intro < 1) cam.intro = Math.min(1, cam.intro + dt / 2.8)
    const e = 1 - Math.pow(1 - cam.intro, 3)
    const pitch = cam.pitch + (1 - e) * 0.55
    const dist = cam.dist + (1 - e) * 9
    const pivot = camTarget.current.set(nx, feetY + PIVOT_H, nz)
    const dir = new THREE.Vector3(-Math.sin(cam.yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(cam.yaw) * Math.cos(pitch))
    let allowed = dist
    const ray = new rapier.Ray(pivot, dir)
    const hit = world.castRay(ray, dist + 0.4, true, undefined, undefined, undefined, rb)
    if (hit) {
      const toi = (hit as unknown as { timeOfImpact?: number; toi?: number }).timeOfImpact ?? (hit as unknown as { toi: number }).toi
      allowed = Math.max(0.5, toi - 0.35)
    }
    // pull in immediately when blocked, ease back out when clear
    cam.actualDist = allowed < cam.actualDist ? allowed : cam.actualDist + (allowed - cam.actualDist) * Math.min(1, dt * 3)
    const want = pivot.clone().addScaledVector(dir, Math.min(cam.actualDist, allowed))
    if (firstFrame.current) {
      camPos.current.copy(want)
      firstFrame.current = false
    } else camPos.current.lerp(want, Math.min(1, dt * 14))
    camera.position.copy(camPos.current)
    // when a wall pushes the camera right up to the character, hide the avatar instead of clipping into it
    if (visual.current) visual.current.visible = camPos.current.distanceTo(pivot) > 0.85
    camera.lookAt(pivot)
    live.cameraYaw = cam.yaw
    live.cameraPos = [camera.position.x, camera.position.y, camera.position.z]
    live.insideHouse = nz < -20 && Math.abs(nx) < 8
  })

  return (
    <>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[live.playerPos[0], live.playerPos[1] + 0.8, live.playerPos[2]]} enabledRotations={[false, false, false]}>
        <CapsuleCollider args={[0.45, 0.3]} />
      </RigidBody>
      <group ref={visual} position={live.playerPos} rotation={[0, live.playerYaw, 0]}>
        <AvatarModel look={look} motion={motion} />
      </group>
    </>
  )
}
