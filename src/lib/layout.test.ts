import { describe, expect, it } from 'vitest'
import { FRAME, HALL, layoutGallery } from './layout'
import type { Photo } from '../types'

const mk = (n: number, wall: Photo['wall'], aspect = 1.5): Photo[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${wall}${i}`, src: '', caption: '', wall, order: i, aspect }))

describe('layoutGallery', () => {
  it('keeps every frame at eye level and preserves aspect ratio', () => {
    const photos = [...mk(6, 'left', 0.75), ...mk(4, 'back', 1.78), ...mk(6, 'right', 1)]
    const l = layoutGallery(photos)
    expect(l).toHaveLength(16)
    for (const f of l) {
      expect(f.position[1]).toBeCloseTo(HALL.eyeLevel)
      expect(f.width / f.height).toBeCloseTo(f.photo.aspect, 3)
    }
  })
  it('spaces frames evenly without overlap and keeps the portal area clear', () => {
    const l = layoutGallery(mk(8, 'back', 1.5))
    for (const f of l) expect(Math.abs(f.position[0]) - f.width / 2).toBeGreaterThan(HALL.portalClear / 2 - 0.01)
    const left = l.filter((f) => f.position[0] < 0).sort((a, b) => a.position[0] - b.position[0])
    for (let i = 1; i < left.length; i++) {
      const gap = left[i].position[0] - left[i].width / 2 - (left[i - 1].position[0] + left[i - 1].width / 2)
      expect(gap).toBeGreaterThan(FRAME.minGap)
    }
  })
  it('scales frames down when a wall is crowded', () => {
    const l = layoutGallery(mk(12, 'left', 1.78))
    const span = HALL.depth - 2.1
    const used = l.reduce((s, f) => s + f.width, 0)
    expect(used).toBeLessThan(span)
  })
})
