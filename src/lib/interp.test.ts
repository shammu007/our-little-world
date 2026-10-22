import { describe, expect, it } from 'vitest'
import { PoseBuffer, lerpAngle } from './interp'

describe('PoseBuffer', () => {
  it('interpolates between snapshots with a render delay', () => {
    const b = new PoseBuffer(100)
    b.push({ t: 0, p: [0, 0, 0], yaw: 0, anim: 'walk', speed: 1 })
    b.push({ t: 100, p: [10, 0, 0], yaw: 0, anim: 'walk', speed: 1 })
    expect(b.sample(150)!.p[0]).toBeCloseTo(5)
  })
  it('extrapolates briefly and then holds still', () => {
    const b = new PoseBuffer(0, 100)
    b.push({ t: 0, p: [0, 0, 0], yaw: 0, anim: 'walk', speed: 1 })
    b.push({ t: 100, p: [1, 0, 0], yaw: 0, anim: 'walk', speed: 1 })
    expect(b.sample(150)!.p[0]).toBeCloseTo(1.5)
    expect(b.sample(5000)!.p[0]).toBeCloseTo(2)
    expect(b.sample(5000)!.anim).toBe('idle')
  })
  it('takes the short way around when blending angles', () => {
    expect(lerpAngle(3.0, -3.0, 0.5)).toBeCloseTo(Math.PI, 1)
  })
})
