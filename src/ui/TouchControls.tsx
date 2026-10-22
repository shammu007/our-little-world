import { useEffect, useRef, useState } from 'react'
import { input } from '../input/input'
import { useStore } from '../state/store'
import { interact } from '../world/actions'

/**
 * Left half: floating joystick. Right half: drag to look.
 * Large interact button bottom-right, small hop button above it.
 */
export function TouchControls() {
  const focus = useStore((s) => s.focus)
  const cakeOut = useStore((s) => s.cake.out)
  const overlay = useStore((s) => s.overlay)
  const [joy, setJoy] = useState<{ x: number; y: number; kx: number; ky: number } | null>(null)
  const joyId = useRef<number | null>(null)
  const lookId = useRef<number | null>(null)
  const lookLast = useRef({ x: 0, y: 0 })
  const origin = useRef({ x: 0, y: 0 })
  const [used, setUsed] = useState(false)

  useEffect(() => {
    if (overlay) {
      joyId.current = lookId.current = null
      setJoy(null)
      input.joy.active = false
    }
  }, [overlay])

  const R = 50
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    const leftSide = e.clientX < window.innerWidth * 0.45
    if (leftSide && joyId.current === null) {
      joyId.current = e.pointerId
      origin.current = { x: e.clientX, y: e.clientY }
      setJoy({ x: e.clientX, y: e.clientY, kx: 0, ky: 0 })
      input.joy.active = true
      setUsed(true)
    } else if (lookId.current === null) {
      lookId.current = e.pointerId
      lookLast.current = { x: e.clientX, y: e.clientY }
    }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerId === joyId.current) {
      let dx = e.clientX - origin.current.x
      let dy = e.clientY - origin.current.y
      const len = Math.hypot(dx, dy)
      if (len > R) {
        dx = (dx / len) * R
        dy = (dy / len) * R
      }
      input.joy.x = dx / R
      input.joy.y = -dy / R
      setJoy((j) => (j ? { ...j, kx: dx, ky: dy } : j))
    } else if (e.pointerId === lookId.current) {
      input.look.dx += (e.clientX - lookLast.current.x) * 0.007
      input.look.dy += (e.clientY - lookLast.current.y) * 0.005
      lookLast.current = { x: e.clientX, y: e.clientY }
    }
  }
  const onUp = (e: React.PointerEvent) => {
    if (e.pointerId === joyId.current) {
      joyId.current = null
      input.joy.active = false
      input.joy.x = input.joy.y = 0
      setJoy(null)
    } else if (e.pointerId === lookId.current) lookId.current = null
  }

  if (overlay) return null
  let label = 'Look around'
  if (focus) label = focus.kind === 'cake' ? (cakeOut ? 'Relight' : 'Blow!') : focus.kind === 'portal' ? 'Portal' : 'Look closer'
  return (
    <>
      <div className="touch-layer" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} data-testid="touch-layer" />
      {!used && !joy && <div className="joy-ghost">Walk here</div>}
      {joy && (
        <div className="joy-base" style={{ left: joy.x, top: joy.y }}>
          <div className="joy-knob" style={{ transform: `translate(${joy.kx}px, ${joy.ky}px)` }} />
        </div>
      )}
      <div className="touch-buttons">
        <button
          className="jump-btn"
          onPointerDown={(e) => {
            e.stopPropagation()
            input.jump = true
          }}
          aria-label="Hop"
        >
          Hop
        </button>
        <button
          className={`act-btn ${focus ? '' : 'idle'}`}
          onPointerDown={(e) => {
            e.stopPropagation()
            interact()
          }}
          aria-label={focus ? label : 'Nothing to interact with nearby'}
          data-testid="touch-interact"
        >
          {label}
        </button>
      </div>
    </>
  )
}
