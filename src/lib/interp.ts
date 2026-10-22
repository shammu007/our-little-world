export interface PoseSample {
  t: number // local receive time (ms)
  p: [number, number, number]
  yaw: number
  anim: string
  speed: number
}

export function lerpAngle(a: number, b: number, t: number) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI
  if (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

/** Buffered snapshot interpolation: renders remote players slightly in the past for smooth motion. */
export class PoseBuffer {
  samples: PoseSample[] = []
  constructor(public delay = 140, public maxExtrapolate = 250) {}

  push(s: PoseSample) {
    const last = this.samples[this.samples.length - 1]
    if (last && s.t <= last.t) s.t = last.t + 1
    this.samples.push(s)
    if (this.samples.length > 30) this.samples.splice(0, this.samples.length - 30)
  }

  /** Teleport (e.g. on rejoin) – drop history. */
  reset(s: PoseSample) {
    this.samples = [s]
  }

  sample(now: number): PoseSample | null {
    const n = this.samples.length
    if (!n) return null
    const target = now - this.delay
    if (n === 1 || target <= this.samples[0].t) return this.samples[0]
    for (let i = n - 1; i > 0; i--) {
      const a = this.samples[i - 1]
      const b = this.samples[i]
      if (target >= a.t && target <= b.t) {
        const k = (target - a.t) / Math.max(1, b.t - a.t)
        return {
          t: target,
          p: [a.p[0] + (b.p[0] - a.p[0]) * k, a.p[1] + (b.p[1] - a.p[1]) * k, a.p[2] + (b.p[2] - a.p[2]) * k],
          yaw: lerpAngle(a.yaw, b.yaw, k),
          anim: k < 0.5 ? a.anim : b.anim,
          speed: a.speed + (b.speed - a.speed) * k,
        }
      }
    }
    // newer than everything we have: extrapolate a little, then hold
    const a = this.samples[n - 2]
    const b = this.samples[n - 1]
    const over = Math.min(target - b.t, this.maxExtrapolate)
    const dt = Math.max(1, b.t - a.t)
    const k = over / dt
    const moving = b.speed > 0.05 && over > 0
    return {
      t: target,
      p: moving ? [b.p[0] + (b.p[0] - a.p[0]) * k, b.p[1], b.p[2] + (b.p[2] - a.p[2]) * k] : b.p,
      yaw: b.yaw,
      anim: target - b.t > 600 ? 'idle' : b.anim,
      speed: target - b.t > 600 ? 0 : b.speed,
    }
  }
}
