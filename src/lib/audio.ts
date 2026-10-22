/**
 * All sound is synthesised with the Web Audio API (no audio files, no licensing).
 * The context is created on the first user gesture ("Step inside").
 */
let ctx: AudioContext | null = null
let master: GainNode | null = null
let ambience: { stop(): void } | null = null
let muted = false

export function initAudio() {
  if (ctx) {
    void ctx.resume()
    return
  }
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.7
    master.connect(ctx.destination)
  } catch {
    ctx = null
  }
}

export function setMuted(m: boolean) {
  muted = m
  if (ctx && master) master.gain.setTargetAtTime(m ? 0 : 0.7, ctx.currentTime, 0.05)
}

function tone(freq: number, start: number, dur: number, opts: { type?: OscillatorType; gain?: number; attack?: number } = {}) {
  if (!ctx || !master) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = opts.type ?? 'sine'
  o.frequency.value = freq
  const t = ctx.currentTime + start
  const peak = opts.gain ?? 0.15
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + (opts.attack ?? 0.01))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + dur + 0.05)
}

function noise(dur: number, { gain = 0.2, from = 1800, to = 300, start = 0 } = {}) {
  if (!ctx || !master) return
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buf
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  const t = ctx.currentTime + start
  f.frequency.setValueAtTime(from, t)
  f.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.2)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(master)
  src.start(t)
}

export const sfx = {
  chime() {
    tone(880, 0, 0.5, { gain: 0.06 })
    tone(1320, 0.06, 0.6, { gain: 0.04 })
  },
  open() {
    tone(660, 0, 0.35, { gain: 0.05, type: 'triangle' })
    tone(990, 0.05, 0.4, { gain: 0.035, type: 'triangle' })
  },
  blow() {
    noise(1.1, { gain: 0.25, from: 1200, to: 250 })
  },
  pop() {
    for (let i = 0; i < 6; i++) tone(500 + Math.random() * 900, i * 0.05, 0.12, { gain: 0.03, type: 'triangle' })
  },
  wrong() {
    tone(392, 0, 0.25, { gain: 0.06, type: 'triangle' })
    tone(330, 0.16, 0.35, { gain: 0.06, type: 'triangle' })
  },
  portal() {
    noise(2.2, { gain: 0.12, from: 300, to: 3000 })
    ;[523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.2 + i * 0.16, 1.4, { gain: 0.05 }))
  },
  /** "Happy Birthday" (public-domain melody) on a soft music box. */
  birthday() {
    const G4 = 392, A4 = 440, B4 = 493.88, C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99
    const q = 0.36
    const notes: [number, number][] = [
      [G4, 0.75], [G4, 0.25], [A4, 1], [G4, 1], [C5, 1], [B4, 2],
      [G4, 0.75], [G4, 0.25], [A4, 1], [G4, 1], [D5, 1], [C5, 2],
      [G4, 0.75], [G4, 0.25], [G5, 1], [E5, 1], [C5, 1], [B4, 1], [A4, 2],
      [F5, 0.75], [F5, 0.25], [E5, 1], [C5, 1], [D5, 1], [C5, 2],
    ]
    let t = 0.3
    for (const [f, beats] of notes) {
      tone(f, t, beats * q + 0.6, { gain: 0.05, type: 'sine' })
      tone(f * 2, t, beats * q * 0.6 + 0.2, { gain: 0.012, type: 'sine' })
      t += beats * q
    }
  },
}

/** Very soft garden ambience: filtered wind and the occasional little bird. */
export function startAmbience() {
  if (!ctx || !master || ambience) return
  const c = ctx
  const len = c.sampleRate * 4
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
    d[i] = last * 3
  }
  const src = c.createBufferSource()
  src.buffer = buf
  src.loop = true
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 500
  const g = c.createGain()
  g.gain.value = 0.05
  src.connect(f).connect(g).connect(master)
  src.start()
  const bird = window.setInterval(() => {
    if (Math.random() < 0.5 || !ctx) return
    const base = 2400 + Math.random() * 1200
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) tone(base + Math.random() * 400, i * 0.11, 0.09, { gain: 0.012 })
  }, 5200)
  ambience = {
    stop() {
      src.stop()
      window.clearInterval(bird)
    },
  }
}
