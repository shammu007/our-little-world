import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { FRAME, layoutGallery, type FramePlacement } from '../lib/layout'
import { useStore } from '../state/store'
import { registerInteractable } from './interactions'
import { washTexture } from './textures'

const cache = new Map<string, Promise<THREE.Texture>>()

function missingTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 192
  const g = c.getContext('2d')!
  g.fillStyle = '#EEEBE5'
  g.fillRect(0, 0, 256, 192)
  g.fillStyle = '#A8A39A'
  g.font = '600 18px Nunito, sans-serif'
  g.textAlign = 'center'
  g.fillText('Photo unavailable', 128, 100)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Loads a photo and downsizes it for the wall (full resolution is only used in the viewer overlay). */
export function loadWallTexture(src: string, maxSize: number): Promise<THREE.Texture> {
  const key = `${maxSize}|${src}`
  let p = cache.get(key)
  if (!p) {
    p = new Promise<THREE.Texture>((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.decoding = 'async'
      img.onload = () => {
        const w0 = img.naturalWidth || 800
        const h0 = img.naturalHeight || 600
        const k = Math.min(1, maxSize / Math.max(w0, h0))
        const c = document.createElement('canvas')
        c.width = Math.max(2, Math.round(w0 * k))
        c.height = Math.max(2, Math.round(h0 * k))
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
        const t = new THREE.CanvasTexture(c)
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 4
        resolve(t)
      }
      img.onerror = () => {
        cache.delete(key)
        resolve(missingTexture())
      }
      img.src = src
    })
    cache.set(key, p)
  }
  return p
}

function Frame({ f, maxTex }: { f: FramePlacement; maxTex: number }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let alive = true
    loadWallTexture(f.photo.src, maxTex).then((t) => alive && setTex(t))
    return () => {
      alive = false
    }
  }, [f.photo.src, maxTex])

  useEffect(() => {
    const n: [number, number] = [Math.sin(f.rotationY), Math.cos(f.rotationY)]
    return registerInteractable({
      id: `photo:${f.photo.id}`,
      kind: 'photo',
      label: 'Look closer',
      photoId: f.photo.id,
      position: [f.position[0] + n[0] * 1.1, 0, f.position[2] + n[1] * 1.1],
      radius: 1.75,
    })
  }, [f])

  const b = FRAME.border
  const wash = washTexture()
  return (
    <group position={f.position} rotation={[0, f.rotationY, 0]}>
      {/* soft light wash from the picture lamp */}
      <mesh position={[0, -0.25, -0.012]}>
        <planeGeometry args={[f.width * 1.6 + 0.5, f.height + 1.2]} />
        <meshBasicMaterial map={wash} transparent opacity={0.5} depthWrite={false} toneMapped={false} color={'#FFF4E2'} />
      </mesh>
      <mesh position={[0, 0, 0.012]} castShadow={false}>
        <boxGeometry args={[f.width + b * 2, f.height + b * 2, 0.045]} />
        <meshLambertMaterial color={'#CDB290'} />
      </mesh>
      <mesh position={[0, 0, 0.036]}>
        <planeGeometry args={[f.width, f.height]} />
        {tex ? <meshBasicMaterial map={tex} color={'#F7F5F0'} /> : <meshBasicMaterial color={'#EDEAE3'} />}
      </mesh>
      {/* brass picture lamp */}
      <group position={[0, f.height / 2 + b + 0.16, 0.09]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, Math.min(0.6, f.width * 0.5), 10]} />
          <meshLambertMaterial color={'#C7AE7B'} />
        </mesh>
        <mesh position={[0, -0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, Math.min(0.55, f.width * 0.46), 8]} />
          <meshBasicMaterial color={'#FFF3D6'} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.02, -0.06]}>
          <boxGeometry args={[0.03, 0.03, 0.12]} />
          <meshLambertMaterial color={'#C7AE7B'} />
        </mesh>
      </group>
    </group>
  )
}

export function Gallery() {
  const photos = useStore((s) => s.photos)
  const low = useStore((s) => s.settings.quality === 'low')
  const placements = useMemo(() => layoutGallery(photos), [photos])
  return (
    <group>
      {placements.map((f) => (
        <Frame key={f.photo.id + f.photo.src} f={f} maxTex={low ? 512 : 1024} />
      ))}
    </group>
  )
}
