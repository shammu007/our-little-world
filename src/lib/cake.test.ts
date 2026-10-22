import { describe, expect, it } from 'vitest'
import { CANDLE_COUNT, candlePositions } from './cake'

describe('cake', () => {
  it('has exactly 25 candles, all distinct and on the cake', () => {
    const c = candlePositions()
    expect(CANDLE_COUNT).toBe(25)
    expect(c).toHaveLength(25)
    expect(new Set(c.map((p) => p.map((n) => n.toFixed(3)).join())).size).toBe(25)
    for (const p of c) expect(Math.hypot(p[0], p[2])).toBeLessThan(1.25)
  })
})
