/** Shared, mutable input state written by keyboard / mouse / touch handlers and read by the player each frame. */
export const input = {
  keys: new Set<string>(),
  /** analog move from the virtual joystick, x = right, y = forward, length ≤ 1 */
  joy: { x: 0, y: 0, active: false },
  /** accumulated camera rotation deltas (radians) consumed each frame */
  look: { dx: 0, dy: 0 },
  zoom: 0,
  jump: false,
  run: false,
  interactQueued: false,
}

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space'])

function isTyping(e: Event) {
  const t = e.target as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}

export function moveVector(): { x: number; y: number; run: boolean } {
  const k = input.keys
  let x = 0
  let y = 0
  if (k.has('KeyW') || k.has('ArrowUp')) y += 1
  if (k.has('KeyS') || k.has('ArrowDown')) y -= 1
  if (k.has('KeyD') || k.has('ArrowRight')) x += 1
  if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1
  const run = k.has('ShiftLeft') || k.has('ShiftRight') || input.run
  if (input.joy.active) {
    x += input.joy.x
    y += input.joy.y
  }
  const len = Math.hypot(x, y)
  if (len > 1) {
    x /= len
    y /= len
  }
  return { x, y, run: run || (input.joy.active && Math.hypot(input.joy.x, input.joy.y) > 0.92) }
}

let attached = false
export function attachKeyboard(onInteract: () => void, onEscape: () => void, canMove: () => boolean) {
  if (attached) return () => {}
  attached = true
  const down = (e: KeyboardEvent) => {
    if (isTyping(e)) {
      if (e.code === 'Escape') onEscape()
      return
    }
    if (e.code === 'Escape') {
      onEscape()
      return
    }
    if (!canMove()) return
    if (e.code === 'KeyE' || e.code === 'Enter') {
      if (!e.repeat) onInteract()
      e.preventDefault()
      return
    }
    if (MOVE_KEYS.has(e.code)) {
      input.keys.add(e.code)
      if (e.code === 'Space') {
        input.jump = true
        e.preventDefault()
      }
      if (e.code.startsWith('Arrow')) e.preventDefault()
    }
  }
  const up = (e: KeyboardEvent) => input.keys.delete(e.code)
  const blur = () => input.keys.clear()
  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', blur)
  return () => {
    attached = false
    window.removeEventListener('keydown', down)
    window.removeEventListener('keyup', up)
    window.removeEventListener('blur', blur)
  }
}

export function clearInput() {
  input.keys.clear()
  input.joy.active = false
  input.joy.x = input.joy.y = 0
  input.look.dx = input.look.dy = 0
}
