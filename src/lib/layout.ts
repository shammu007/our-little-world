import type { Photo, Wall } from '../types'

/** Hall geometry, shared by the 3D house and the gallery layout. Units are metres. */
export const HALL = {
  width: 16, // x: -8 .. 8
  depth: 14, // z: front .. back
  frontZ: -20,
  backZ: -34,
  height: 4.6,
  wallThickness: 0.3,
  doorWidth: 2,
  doorHeight: 2.7,
  eyeLevel: 1.62,
  portalClear: 5.2, // clear section in the middle of the back wall
  portalCenterY: 2.05,
  portalRadius: 1.15,
}

export const FRAME = { baseHeight: 1.12, maxWidth: 1.85, minGap: 0.35, border: 0.07 }
/** The main (back) wall holds one medium photo on each side of the portal. */
export const MAIN_WALL = { max: 2, baseHeight: 1.45, maxWidth: 2.15 }

export interface FramePlacement {
  photo: Photo
  /** centre of the picture surface */
  position: [number, number, number]
  /** rotation around Y so the picture faces into the room */
  rotationY: number
  width: number
  height: number
  /** where a visitor should stand to look at it */
  viewPoint: [number, number, number]
}

interface Segment {
  wall: Wall
  /** start and end along the wall, in "reading" order (left → right for a viewer facing the wall) */
  from: number
  to: number
}

const inset = HALL.wallThickness / 2 + 0.03

function segmentsFor(wall: Wall): Segment[] {
  const hw = HALL.width / 2
  const front = HALL.frontZ - 1.1
  const back = HALL.backZ + 1.0
  if (wall === 'left') return [{ wall, from: front, to: back }] // viewer faces -x, reads +z → -z
  if (wall === 'right') return [{ wall, from: back, to: front }] // viewer faces +x, reads -z → +z
  const c = HALL.portalClear / 2
  return [
    { wall, from: -hw + 0.8, to: -c },
    { wall, from: c, to: hw - 0.8 },
  ]
}

function toWorld(wall: Wall, along: number, y: number): [number, number, number] {
  const hw = HALL.width / 2
  if (wall === 'left') return [-hw + inset, y, along]
  if (wall === 'right') return [hw - inset, y, along]
  return [along, y, HALL.backZ + inset]
}

const rotationFor: Record<Wall, number> = { left: Math.PI / 2, right: -Math.PI / 2, back: 0 }
const normalFor: Record<Wall, [number, number]> = { left: [1, 0], right: [-1, 0], back: [0, 1] }

export function frameSize(aspect: number, scale = 1, wall: Wall = 'left') {
  const a = Math.min(5, Math.max(0.2, aspect || 1))
  const maxW = wall === 'back' ? MAIN_WALL.maxWidth : FRAME.maxWidth
  let h = wall === 'back' ? MAIN_WALL.baseHeight : FRAME.baseHeight
  let w = h * a
  if (w > maxW) {
    w = maxW
    h = w / a
  }
  return { width: w * scale, height: h * scale }
}

function layoutSegment(seg: Segment, photos: Photo[]): FramePlacement[] {
  if (!photos.length) return []
  const len = Math.abs(seg.to - seg.from)
  const dir = Math.sign(seg.to - seg.from)
  let sizes = photos.map((p) => frameSize(p.aspect, 1, seg.wall))
  const total = sizes.reduce((s, x) => s + x.width + FRAME.border * 2, 0)
  const maxContent = len - FRAME.minGap * (photos.length + 1)
  if (total > maxContent) {
    const k = Math.max(0.3, maxContent / total)
    sizes = photos.map((p) => frameSize(p.aspect, k, seg.wall))
  }
  const used = sizes.reduce((s, x) => s + x.width + FRAME.border * 2, 0)
  const gap = (len - used) / (photos.length + 1)
  let cursor = gap
  return photos.map((photo, i) => {
    const { width, height } = sizes[i]
    const along = seg.from + dir * (cursor + FRAME.border + width / 2)
    cursor += width + FRAME.border * 2 + gap
    const position = toWorld(seg.wall, along, HALL.eyeLevel)
    const [nx, nz] = normalFor[seg.wall]
    return {
      photo,
      position,
      rotationY: rotationFor[seg.wall],
      width,
      height,
      viewPoint: [position[0] + nx * 1.6, 0, position[2] + nz * 1.6],
    }
  })
}

/**
 * Evenly spaces photos along the side walls, keeping aspect ratios and a common eye-level centre line.
 * The main wall shows at most two photos, one centred on each side of the portal; any extra ones
 * (from older saves) move to the emptier side wall.
 */
export function layoutGallery(photos: Photo[]): FramePlacement[] {
  const byWall: Record<Wall, Photo[]> = { left: [], back: [], right: [] }
  for (const p of photos) (byWall[p.wall] ?? byWall.left).push(p)
  for (const w of ['left', 'back', 'right'] as Wall[]) byWall[w].sort((a, b) => a.order - b.order)
  for (const extra of byWall.back.splice(MAIN_WALL.max)) (byWall.left.length <= byWall.right.length ? byWall.left : byWall.right).push(extra)
  const out: FramePlacement[] = []
  for (const wall of ['left', 'back', 'right'] as Wall[]) {
    const list = byWall[wall]
    const segs = segmentsFor(wall)
    if (segs.length === 1) out.push(...layoutSegment(segs[0], list))
    else if (list.length === 1) out.push(...layoutSegment(segs[0], list))
    else out.push(...layoutSegment(segs[0], list.slice(0, 1)), ...layoutSegment(segs[1], list.slice(1, 2)))
  }
  return out
}

export const GALLERY_LIMITS = { min: 12, max: 20, hardMax: 24 }

/** Where every visitor appears: just inside the garden gate, facing the cake. */
export const SPAWN: [number, number, number] = [0, 0.2, 33]
