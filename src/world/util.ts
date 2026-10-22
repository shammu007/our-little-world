import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const PALETTE = {
  grass: '#5FC03E',
  grassDark: '#4DAA34',
  grassLight: '#78D152',
  foliage: ['#4FA83A', '#5DB846', '#45963A', '#6CC24F'],
  trunk: '#8A5E3C',
  path: '#DCCFB6',
  pathDark: '#CBBC9F',
  flower: '#FFFFFF',
  flowerCenter: '#F7C844',
  tulip: '#E8242F',
  tulipPink: '#F2668B',
  houseOuter: '#FAF6EF',
  houseTrim: '#E2DAD0',
  roof: '#9E8478',
  wall: '#FAFAF8',
  oak: '#D6B88F',
  hedge: '#4E9A3A',
  stone: '#B9B5AE',
  wood: '#B08E6E',
  portal: '#2E9BFF',
}

/** Small deterministic PRNG so the garden looks the same on both devices. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** Paints a whole geometry with one vertex colour (with optional per-vertex jitter). */
export function paint(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, jitter = 0, rand: () => number = Math.random) {
  const g = geo.index ? geo.toNonIndexed() : geo
  const c = new THREE.Color(color)
  const n = g.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i += 3) {
    const k = 1 + (rand() - 0.5) * jitter
    for (let j = 0; j < 3 && i + j < n; j++) {
      arr[(i + j) * 3] = c.r * k
      arr[(i + j) * 3 + 1] = c.g * k
      arr[(i + j) * 3 + 2] = c.b * k
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  if (g.attributes.uv) g.deleteAttribute('uv')
  return g
}

export function merge(geos: THREE.BufferGeometry[]) {
  const g = mergeGeometries(geos, false)
  if (!g) throw new Error('mergeGeometries failed')
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

/** Displace vertices of a low-poly blob slightly for an organic, hand-made look. */
export function wobble(geo: THREE.BufferGeometry, amount: number, rand: () => number) {
  const pos = geo.attributes.position
  const map = new Map<string, [number, number, number]>()
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`
    let d = map.get(key)
    if (!d) {
      d = [(rand() - 0.5) * amount, (rand() - 0.5) * amount, (rand() - 0.5) * amount]
      map.set(key, d)
    }
    pos.setXYZ(i, pos.getX(i) + d[0], pos.getY(i) + d[1], pos.getZ(i) + d[2])
  }
  pos.needsUpdate = true
  return geo
}

export const vertexMat = (opts: THREE.MeshLambertMaterialParameters = {}) =>
  new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...opts })

/** A puffy extruded heart, centred on the origin, about `size` tall, facing +z. */
export function heartGeometry(size: number, depth = 0.35, curveSegments = 10) {
  const shape = new THREE.Shape()
  const n = 48
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2
    const x = 16 * Math.sin(t) ** 3
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  const bevel = depth * 14
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth * 16, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 4, curveSegments })
  g.center()
  const k = size / 32
  g.scale(k, k, k)
  if (g.attributes.uv) g.deleteAttribute('uv')
  g.computeVertexNormals()
  return g
}
