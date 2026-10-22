import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { FRAME, layoutGallery, type FramePlacement } from '../lib/layout'
import { useStore } from '../state/store'
import { registerInteractable } from './interactions'
import { washTexture } from './textures'
import { isTouchDevice } from '../lib/device'

const cache = new Map<string, Promise<THREE.Texture>>()

function missingTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 192
  const g = c.getContext('2d')!
  g.fillStyle = '#E9DCCB'
  g.fillRect(0, 0, 256, 192)
  g.fillStyle = '#8A7058'
  g.font = '600 17px Nunito, sans-serif'
  g.textAlign = 'center'
  g.fillText('This photo could not load', 128, 92)
  g.font = '500 14px Nunito, sans-serif'
  g.fillText('Try uploading it again', 128, 116)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Turns a data: URL into a Blob without any network request (so no page policy can block it). */
function dataUrlToBlob(url: string) {
  const comma = url.indexOf(',')
  const head = url.slice(5, comma)
  const body = url.slice(comma + 1)
  const type = head.split(';')[0] || 'application/octet-stream'
  if (!head.includes(';base64')) return new Blob([decodeURIComponent(body)], { type })
  const bin = atob(body)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

function imageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('image failed'))
    img.src = src
  })
}

/** Decodes a photo, trying the most reliable route first and falling back to the others. */
async function decodePhoto(src: string): Promise<{ source: CanvasImageSource; w: number; h: number; close?: () => void }> {
  const attempts: (() => Promise<{ source: CanvasImageSource; w: number; h: number; close?: () => void }>)[] = []
  const viaBitmap = (blob: () => Promise<Blob>) => async () => {
    const bmp = await createImageBitmap(await blob())
    return { source: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() }
  }
  const viaImage = async () => {
    const img = await imageElement(src)
    return { source: img, w: img.naturalWidth || 800, h: img.naturalHeight || 600 }
  }
  const raster = !/^data:image\/svg/.test(src) && !/\.svg(\?|$)/.test(src)
  if (src.startsWith('data:') && raster && 'createImageBitmap' in window) attempts.push(viaBitmap(async () => dataUrlToBlob(src)))
  attempts.push(viaImage)
  if (!src.startsWith('data:') && raster && 'createImageBitmap' in window)
    attempts.push(viaBitmap(async () => (await fetch(src, { mode: 'cors' })).blob()))
  let last: unknown
  for (const attempt of attempts) {
    try {
      return await attempt()
    } catch (e) {
      last = e
    }
  }
  throw last
}

/** Loads a photo and downsizes it for the wall (full resolution is only used in the viewer overlay). */
export function loadWallTexture(src: string, maxSize: number): Promise<THREE.Texture> {
  const key = `${maxSize}|${src}`
  let p = cache.get(key)
  if (!p) {
    p = decodePhoto(src)
      .then(({ source, w, h, close }) => {
        const k = Math.min(1, maxSize / Math.max(w, h))
        const c = document.createElement('canvas')
        c.width = Math.max(2, Math.round(w * k))
        c.height = Math.max(2, Math.round(h * k))
        c.getContext('2d')!.drawImage(source, 0, 0, c.width, c.height)
        close?.()
        const t = new THREE.CanvasTexture(c)
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 4
        return t
      })
      .catch((e) => {
        console.warn('Photo could not load', e)
        cache.delete(key)
        return missingTexture()
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
        <Frame key={f.photo.id + f.photo.src} f={f} maxTex={low ? 512 : isTouchDevice() ? 768 : 1024} />
      ))}
    </group>
  )
}
