import * as THREE from 'three'

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

let glow: THREE.Texture | null = null
/** Soft radial glow used for candle halos, picture lights and the portal. */
export function glowTexture() {
  if (glow) return glow
  const [c, g] = canvas(128, 128)
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  grd.addColorStop(0.6, 'rgba(255,255,255,0.12)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  glow = new THREE.CanvasTexture(c)
  glow.colorSpace = THREE.SRGBColorSpace
  return glow
}

let wash: THREE.Texture | null = null
/** Downward light-wash cone painted on the wall under each picture lamp. */
export function washTexture() {
  if (wash) return wash
  const [c, g] = canvas(256, 256)
  g.save()
  g.translate(128, 18)
  g.scale(1, 2.1)
  const grd = g.createRadialGradient(0, 0, 4, 0, 0, 118)
  grd.addColorStop(0, 'rgba(255,246,228,0.9)')
  grd.addColorStop(0.4, 'rgba(255,244,224,0.38)')
  grd.addColorStop(1, 'rgba(255,244,224,0)')
  g.fillStyle = grd
  g.fillRect(-128, -18, 256, 256)
  g.restore()
  wash = new THREE.CanvasTexture(c)
  wash.colorSpace = THREE.SRGBColorSpace
  return wash
}

let oak: THREE.Texture | null = null
/** Light oak planks, drawn procedurally. */
export function oakTexture() {
  if (oak) return oak
  const [c, g] = canvas(1024, 1024)
  const rows = 8
  const h = 1024 / rows
  let seed = 3
  const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
  for (let y = 0; y < rows; y++) {
    let x = -r() * 400
    while (x < 1024) {
      const w = 380 + r() * 420
      g.fillStyle = `hsl(${32 + r() * 5}, ${26 + r() * 9}%, ${75 + r() * 7}%)`
      g.fillRect(x, y * h, w, h)
      // grain
      for (let k = 0; k < 14; k++) {
        g.globalAlpha = 0.06 + r() * 0.08
        g.fillStyle = r() > 0.4 ? '#8a6440' : '#fff4e2'
        const yy = y * h + r() * h
        g.beginPath()
        g.moveTo(x, yy)
        g.bezierCurveTo(x + w * 0.3, yy + (r() - 0.5) * 8, x + w * 0.7, yy + (r() - 0.5) * 8, x + w, yy + (r() - 0.5) * 4)
        g.lineWidth = 1 + r() * 2
        g.strokeStyle = g.fillStyle
        g.stroke()
      }
      g.globalAlpha = 1
      g.fillStyle = 'rgba(105,75,45,0.45)'
      g.fillRect(x, y * h, 2, h)
      x += w
    }
    g.fillStyle = 'rgba(105,75,45,0.4)'
    g.fillRect(0, y * h, 1024, 2)
  }
  oak = new THREE.CanvasTexture(c)
  oak.colorSpace = THREE.SRGBColorSpace
  oak.wrapS = oak.wrapT = THREE.RepeatWrapping
  oak.anisotropy = 8
  return oak
}

/** Renders text (e.g. the birthday sign) into a texture using the bundled handwriting font. */
export async function textTexture(text: string, opts: { w?: number; h?: number; font?: string; color?: string; bg?: string; size?: number }) {
  const w = opts.w ?? 1024
  const h = opts.h ?? 512
  const family = opts.font ?? 'Caveat'
  try {
    await document.fonts.load(`700 ${opts.size ?? 160}px "${family}"`)
  } catch {
    /* fall back to whatever is available */
  }
  const [c, g] = canvas(w, h)
  if (opts.bg) {
    g.fillStyle = opts.bg
    g.fillRect(0, 0, w, h)
  }
  g.fillStyle = opts.color ?? '#5b4636'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const lines = text.split('\n')
  let size = opts.size ?? 160
  g.font = `700 ${size}px "${family}", "Segoe Print", cursive`
  while (size > 30 && lines.some((l) => g.measureText(l).width > w * 0.9)) {
    size -= 6
    g.font = `700 ${size}px "${family}", "Segoe Print", cursive`
  }
  const lh = size * 1.05
  lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh))
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Name tag sprite texture for remote players. */
export function labelTexture(text: string) {
  const [c, g] = canvas(256, 64)
  g.font = '600 30px Nunito, system-ui, sans-serif'
  const w = Math.min(240, g.measureText(text).width + 36)
  g.fillStyle = 'rgba(255,255,255,0.85)'
  const x = (256 - w) / 2
  g.beginPath()
  g.roundRect(x, 8, w, 48, 24)
  g.fill()
  g.fillStyle = '#4b4a44'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 128, 33)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
