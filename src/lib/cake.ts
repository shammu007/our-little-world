/** Cake dimensions and the 25 candle positions (13 + 8 + 4 on the three tier ledges). */
export const CANDLE_COUNT = 25
export const PEDESTAL_H = 0.5
export const TIERS = [
  { r: 1.25, h: 0.7, sponge: '#7CC9F0', drip: '#FF9EC0', bead: '#FFFFFF' },
  { r: 0.9, h: 0.6, sponge: '#FFD45C', drip: '#FFB3CC', bead: '#FFFFFF' },
  { r: 0.55, h: 0.5, sponge: '#FF9EC0', drip: '#6B3A22', bead: '#FFE7A8' },
]
export const tierBase = (i: number) => PEDESTAL_H + TIERS.slice(0, i).reduce((s, t) => s + t.h, 0)

/** 13 + 8 + 4 = 25 candles on the three tier ledges. */
export function candlePositions(): [number, number, number][] {
  const rings = [
    { n: 13, r: 1.07, y: tierBase(1) },
    { n: 8, r: 0.72, y: tierBase(2) },
    { n: 4, r: 0.28, y: tierBase(3) },
  ]
  const out: [number, number, number][] = []
  rings.forEach((ring, k) => {
    for (let i = 0; i < ring.n; i++) {
      const a = (i / ring.n) * Math.PI * 2 + k * 0.4
      out.push([Math.cos(a) * ring.r, ring.y, Math.sin(a) * ring.r])
    }
  })
  return out
}

