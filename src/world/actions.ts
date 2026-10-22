import { sfx } from '../lib/audio'
import { room } from '../net/room'
import { useStore } from '../state/store'

/** Runs the action for whatever the player is currently near (E key / interact button). */
export function interact() {
  const s = useStore.getState()
  if (s.phase !== 'playing' || s.superseded) return
  if (s.overlay) return
  const f = s.focus
  if (!f) return
  if (f.kind === 'photo' && f.photoId) {
    sfx.open()
    s.openOverlay({ type: 'photo', photoId: f.photoId })
  } else if (f.kind === 'cake') {
    const out = !s.cake.out
    room.setCake(out)
    if (out) {
      sfx.blow()
      window.setTimeout(() => {
        sfx.pop()
        sfx.birthday()
      }, 650)
    } else sfx.chime()
  } else if (f.kind === 'portal') {
    sfx.chime()
    s.openOverlay(s.letter ? { type: 'letter' } : { type: 'portal' })
  }
}
