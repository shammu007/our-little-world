import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { getBackend } from '../backend'
import { clearInput } from '../input/input'
import { sfx } from '../lib/audio'
import { env } from '../lib/env'
import { layoutGallery } from '../lib/layout'
import { room } from '../net/room'
import { leaveWorld } from '../session'
import { useStore } from '../state/store'
import { Icon } from './icons'
import { SafeForm } from './SafeForm'

const Editor = lazy(() => import('./Editor'))

function useEscape(fn: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && fn()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [fn])
}

function Shell({ children, onClose, label, className = '' }: { children: React.ReactNode; onClose: () => void; label: string; className?: string }) {
  useEscape(onClose)
  return (
    <div className={`overlay ${className}`} role="dialog" aria-modal="true" aria-label={label} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      {children}
    </div>
  )
}

function PhotoViewer({ photoId }: { photoId: string }) {
  const photos = useStore((s) => s.photos)
  const close = useStore((s) => s.closeOverlay)
  const open = useStore((s) => s.openOverlay)
  // walking order: left wall, back wall, right wall
  const ordered = useMemo(() => layoutGallery(photos).map((f) => f.photo), [photos])
  const idx = ordered.findIndex((p) => p.id === photoId)
  const photo = ordered[idx]
  const go = (d: number) => {
    const n = ordered[(idx + d + ordered.length) % ordered.length]
    if (n) open({ type: 'photo', photoId: n.id })
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [photoId])
  if (!photo) return null
  return (
    <Shell onClose={close} label="Photo">
      <div className="photo-view" onPointerDown={(e) => e.target === e.currentTarget && close()}>
        <figure key={photo.id} data-testid="photo-viewer">
          {failed ? (
            <div style={{ width: 'min(80vw, 600px)', aspectRatio: String(photo.aspect), display: 'grid', placeItems: 'center', color: 'var(--ink-faint)' }}>
              This photo could not be loaded.
            </div>
          ) : (
            <img src={photo.src} alt={photo.caption || 'Photo'} style={{ aspectRatio: String(photo.aspect) }} onError={() => setFailed(true)} />
          )}
          {photo.caption && <figcaption>{photo.caption}</figcaption>}
        </figure>
        <div className="photo-nav">
          <button className="icon-btn" onClick={() => go(-1)} aria-label="Previous photo">
            <Icon.left />
          </button>
          <span>
            {idx + 1} / {ordered.length}
          </span>
          <button className="icon-btn" onClick={() => go(1)} aria-label="Next photo">
            <Icon.right />
          </button>
          <button className="icon-btn" onClick={close} aria-label="Close">
            <Icon.close />
          </button>
        </div>
      </div>
    </Shell>
  )
}

function PortalDialog() {
  const close = useStore((s) => s.closeOverlay)
  const portal = useStore((s) => s.portal)
  const [answer, setAnswer] = useState('')
  const [state, setState] = useState<{ busy: boolean; hint?: string; message?: string; tries: number }>({ busy: false, tries: 0 })
  const [shake, setShake] = useState(0)
  const [flash, setFlash] = useState(false)
  const offline = useStore((s) => s.conn === 'offline' && s.identity?.userId === 'offline')

  const submit = async () => {
    if (!answer.trim() || state.busy) return
    setState((s) => ({ ...s, busy: true, message: undefined }))
    try {
      const backend = await getBackend()
      const res = await backend.verifyPortal(answer)
      if (res.ok) {
        sfx.portal()
        setFlash(true)
        room.portalOpened()
        useStore.setState((s) => ({ letter: res.letter, portalSeq: s.portalSeq + 1 }))
        window.setTimeout(() => useStore.getState().openOverlay({ type: 'letter' }), useStore.getState().settings.reducedMotion ? 200 : 1500)
        return
      }
      sfx.wrong()
      setShake((n) => n + 1)
      setState((s) => ({
        busy: false,
        tries: s.tries + 1,
        hint: res.hint,
        message: res.message ?? (res.rateLimited ? 'Take a little breather and try again soon.' : ['Not quite. The portal flickers kindly. Try again?', 'Close, maybe. Have another go.', 'Hmm, not that one. Here is a hint.'][Math.min(2, s.tries)]),
      }))
    } catch {
      setState((s) => ({ ...s, busy: false, message: 'The portal could not reach the server. Check the connection and try again.' }))
    }
  }

  return (
    <Shell onClose={close} label="Portal">
      {flash && <div className="flash" />}
      <div className={`panel portal-panel ${shake ? 'shake' : ''}`} key={shake} style={{ opacity: flash ? 0 : 1, transition: 'opacity .4s' }}>
        <button className="close" onClick={close} aria-label="Close">
          <Icon.close />
        </button>
        <h2>The glowing portal</h2>
        <p className="clue" data-testid="portal-dialog-clue">
          {portal?.clue ?? 'The portal is quiet. It needs a connection to speak.'}
        </p>
        {!offline && portal && (
          <SafeForm onSubmit={submit} className="stack">
            <input className="input" autoFocus autoComplete="off" placeholder="Your answer" value={answer} onChange={(e) => setAnswer(e.target.value)} aria-label="Your answer" data-testid="portal-answer" />
            {state.message && (
              <p className="hint" role="status" style={{ margin: 0 }}>
                {state.message}
                {state.hint && state.tries >= 2 && (
                  <>
                    <br />
                    <b>Hint:</b> {state.hint}
                  </>
                )}
              </p>
            )}
            <div className="row">
              <button type="button" className="btn portal" onClick={submit} disabled={state.busy || !answer.trim()} data-testid="portal-submit">
                {state.busy ? 'Listening…' : 'Speak to the portal'}
              </button>
            </div>
          </SafeForm>
        )}
      </div>
    </Shell>
  )
}

function LetterView() {
  const letter = useStore((s) => s.letter)
  const close = useStore((s) => s.closeOverlay)
  const reduced = useStore((s) => s.settings.reducedMotion)
  const petals = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        left: `${(i * 61) % 100}%`,
        delay: `${(i * 0.9) % 9}s`,
        dur: `${9 + (i % 5) * 2}s`,
        dx: `${((i % 7) - 3) * 30}px`,
      })),
    [],
  )
  if (!letter) return null
  const step = reduced ? 0 : 0.55
  return (
    <Shell onClose={close} label="Letter">
      {!reduced && (
        <div className="petals" aria-hidden>
          {petals.map((p, i) => (
            <i key={i} style={{ left: p.left, animationDelay: p.delay, animationDuration: p.dur, ['--dx' as string]: p.dx }} />
          ))}
        </div>
      )}
      <div className="letter-wrap">
        <article className="letter" data-testid="letter">
          <button className="close" onClick={close} aria-label="Close letter">
            <Icon.close />
          </button>
          <h2>{letter.title}</h2>
          <p className="greet" style={{ animationDelay: `${step * 1}s` }}>
            {letter.greeting}
          </p>
          {letter.paragraphs.map((p, i) => (
            <p key={i} style={{ animationDelay: `${step * (i + 2)}s` }}>
              {p}
            </p>
          ))}
          <p className="sig" style={{ animationDelay: `${step * (letter.paragraphs.length + 2)}s` }}>
            {letter.signature}
          </p>
          <svg className="seal" viewBox="0 0 40 40" aria-hidden>
            <circle cx="20" cy="20" r="18" fill="#C98E86" />
            <path d="M20 28s-7-4.4-7-9.2A3.8 3.8 0 0120 17a3.8 3.8 0 017 1.8c0 4.8-7 9.2-7 9.2z" fill="#F6E1DC" />
          </svg>
        </article>
      </div>
    </Shell>
  )
}

function Settings() {
  const close = useStore((s) => s.closeOverlay)
  const settings = useStore((s) => s.settings)
  const set = useStore((s) => s.setSettings)
  const identity = useStore((s) => s.identity)
  const Switch = ({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) => (
    <button className="switch" role="switch" aria-checked={on} aria-label={label} onClick={onClick} />
  )
  return (
    <Shell onClose={close} label="Settings">
      <div className="panel">
        <button className="close" onClick={close} aria-label="Close">
          <Icon.close />
        </button>
        <h2>Settings</h2>
        <div className="setting">
          <div>
            <div className="label">Sound</div>
            <div className="desc">Music box, birds and little chimes.</div>
          </div>
          <Switch on={!settings.muted} onClick={() => set({ muted: !settings.muted })} label="Sound" />
        </div>
        <div className="setting">
          <div>
            <div className="label">Reduced motion</div>
            <div className="desc">Calmer camera, fewer particles, no swirling.</div>
          </div>
          <Switch on={settings.reducedMotion} onClick={() => set({ reducedMotion: !settings.reducedMotion })} label="Reduced motion" />
        </div>
        <div className="setting">
          <div>
            <div className="label">Graphics</div>
            <div className="desc">Use Light on older phones.</div>
          </div>
          <div className="seg" role="group" aria-label="Graphics quality">
            {(['high', 'low'] as const).map((q) => (
              <button key={q} aria-pressed={settings.quality === q} onClick={() => set({ quality: q })}>
                {q === 'high' ? 'Beautiful' : 'Light'}
              </button>
            ))}
          </div>
        </div>
        <div className="setting" style={{ display: 'block' }}>
          <div className="label">About this visit</div>
          <p className="desc" style={{ margin: '0.3rem 0 0', lineHeight: 1.5 }}>
            {env.hasSupabase
              ? 'You are signed in anonymously on this browser. Clearing site data or using a private window gives you a new identity, so you may need to answer the entrance questions again.'
              : 'Demo mode: everything is stored in this browser only and is not private. Connect Supabase to protect the letter and photos.'}
            {identity && identity.userId !== 'offline' && (
              <>
                <br />
                Visitor id: <code>{identity.userId.slice(0, 8)}</code>
              </>
            )}
          </p>
        </div>
        <div className="row" style={{ marginTop: '1rem' }}>
          <button
            className="btn ghost"
            onClick={() => {
              close()
              void leaveWorld()
            }}
          >
            Leave the world
          </button>
        </div>
      </div>
    </Shell>
  )
}

function Help() {
  const close = useStore((s) => s.closeOverlay)
  return (
    <Shell onClose={close} label="Help">
      <div className="panel">
        <button className="close" onClick={close} aria-label="Close">
          <Icon.close />
        </button>
        <h2>How to wander</h2>
        <div className="stack hint" style={{ fontSize: '1rem', lineHeight: 1.55, color: 'var(--ink)' }}>
          <div>
            <b>Computer:</b> W A S D or arrow keys to walk, Shift to run, Space to hop. Drag with the mouse to look around, scroll to zoom. Press E near something
            glowing or interesting.
          </div>
          <div>
            <b>Phone:</b> touch the left side to walk with the joystick, drag on the right side to look, and tap the round button to interact.
          </div>
          <div>
            <b>Things to find:</b> the cake in the middle of the garden, the photos in the house, and the blue portal on the far wall.
          </div>
        </div>
      </div>
    </Shell>
  )
}

export function Overlays() {
  const overlay = useStore((s) => s.overlay)
  const close = useStore((s) => s.closeOverlay)
  const prev = useRef(overlay)
  useEffect(() => {
    if (overlay && !prev.current) clearInput()
    prev.current = overlay
  }, [overlay])
  if (!overlay) return null
  switch (overlay.type) {
    case 'photo':
      return <PhotoViewer photoId={overlay.photoId} />
    case 'portal':
      return <PortalDialog />
    case 'letter':
      return <LetterView />
    case 'settings':
      return <Settings />
    case 'help':
      return <Help />
    case 'editor':
      return (
        <Suspense
          fallback={
            <Shell onClose={close} label="Editor">
              <div className="panel">Loading editor…</div>
            </Shell>
          }
        >
          <Editor />
        </Suspense>
      )
  }
}
