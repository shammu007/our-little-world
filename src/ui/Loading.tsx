import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { CakeMark } from './icons'

const lines = ['Planting the flowers…', 'Frosting the cake…', 'Lighting 25 candles…', 'Hanging the photos…', 'Polishing the portal…']

export function Loading() {
  const phase = useStore((s) => s.phase)
  const ready = useStore((s) => s.worldReady)
  const [i, setI] = useState(0)
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => (n + 1) % lines.length), 1400)
    const s = window.setTimeout(() => setSlow(true), 15000)
    return () => {
      window.clearInterval(t)
      window.clearTimeout(s)
    }
  }, [])
  const done = phase === 'playing' && ready
  return (
    <div className={`loading ${done ? 'done' : ''}`} aria-hidden={done} role="status">
      <div className="inner">
        <CakeMark className="loader-cake" />
        <div className="title">Our Little World</div>
        <div className="bar">
          <i />
        </div>
        <div className="hint">{lines[i]}</div>
        {slow && !ready && <div className="hint">This is taking a while. A slower phone may do better with Light graphics in Settings.</div>}
      </div>
    </div>
  )
}
