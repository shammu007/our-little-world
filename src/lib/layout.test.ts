import { describe, expect, it } from 'vitest'
import { FRAME, HALL, layoutGallery } from './layout'
import type { Photo } from '../types'

const mk = (n: number, wall: Photo['wall'], aspect = 1.5): Photo[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${wall}${i}`, src: '', caption: '', wall, order: i, aspect }))

describe('layoutGallery', () => {
  it('keeps every frame at eye level and preserves aspect ratio', () => {
    const photos = [...mk(7, 'left', 0.75), ...mk(2, 'back', 1.78), ...mk(7, 'right', 1)]
    const l = layoutGallery(photos)
    expect(l).toHaveLength(16)
    for (const f of l) {
      expect(f.position[1]).toBeCloseTo(HALL.eyeLevel)
      expect(f.width / f.height).toBeCloseTo(f.photo.aspect, 3)
    }
  })
  it('shows one medium photo on each side of the portal and moves extras to the side walls', () => {
    const l = layoutGallery([...mk(5, 'back', 1.5), ...mk(2, 'left', 1.5)])
    expect(l).toHaveLength(7)
    const back = l.filter((f) => f.photo.wall === 'back' && f.rotationY === 0)
    expect(back).toHaveLength(2)
    expect(back[0].position[0]).toBeLessThan(0)
    expect(back[1].position[0]).toBeGreaterThan(0)
    for (const f of back) {
      expect(Math.abs(f.position[0]) - f.width / 2).toBeGreaterThan(HALL.portalClear / 2 - 0.01)
      expect(f.height).toBeGreaterThan(FRAME.baseHeight)
    }
  })
  it('spaces side-wall frames evenly without overlap', () => {
    const l = layoutGallery(mk(8, 'left', 1.5)).sort((a, b) => b.position[2] - a.position[2])
    for (let i = 1; i < l.length; i++) {
      const gap = l[i - 1].position[2] - l[i - 1].width / 2 - (l[i].position[2] + l[i].width / 2)
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
