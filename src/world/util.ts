import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const PALETTE = {
  grass: '#A7B58F',
  grassDark: '#93A37C',
  grassLight: '#B7C3A0',
  foliage: ['#7F9C6E', '#8CA87A', '#728F65', '#98AE83'],
  trunk: '#8A6E58',
  path: '#DCCFB6',
  pathDark: '#CBBC9F',
  flower: '#FAF8F2',
  flowerCenter: '#E9D9A6',
  houseOuter: '#FAF6EF',
  houseTrim: '#E2DAD0',
  roof: '#9E8478',
  wall: '#FAFAF8',
  oak: '#D6B88F',
  hedge: '#7E9770',
  stone: '#D9D3C7',
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
