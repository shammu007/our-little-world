import { useEffect, useState } from 'react'
import { content } from '../content/content'
import { isTouchDevice } from '../lib/device'
import { setMuted } from '../lib/audio'
import { room } from '../net/room'
import { useStore } from '../state/store'
import { interact } from '../world/actions'
import { Icon } from './icons'

function Players() {
  const identity = useStore((s) => s.identity)
  const remotes = useStore((s) => s.remotes)
  const conn = useStore((s) => s.conn)
  if (!identity) return null
  const otherRole = identity.role === 'me' ? 'sweetheart' : 'me'
  const other = remotes.find((r) => r.role === otherRole)
  const connText =
    conn === 'online' ? null : conn === 'offline' ? 'Offline' : conn === 'reconnecting' ? 'Reconnecting…' : conn === 'connecting' ? 'Connecting…' : 'Connection problem'
  return (
    <div className="players" aria-live="polite">
      <div className="pill">
        <span className="dot on" />
        {identity.name} <span style={{ color: 'var(--ink-faint)', fontWeight: 600 }}>(you)</span>
      </div>
      {conn !== 'offline' && (
        <div className="pill" data-testid="partner-status">
          <span className={`dot ${other ? 'on' : ''}`} />
          {content.roles[otherRole].displayName}
          <span style={{ color: 'var(--ink-faint)', fontWeight: 600 }}>{other ? 'is here' : 'not here yet'}</span>
        </div>
      )}
      {connText && (
        <div className="pill">
          <span className="dot warn" />
          {connText}
        </div>
      )}
    </div>
  )
}

function Prompt() {
  const focus = useStore((s) => s.focus)
  const overlay = useStore((s) => s.overlay)
  const cakeOut = useStore((s) => s.cake.out)
  const portal = useStore((s) => s.portal)
  const letter = useStore((s) => s.letter)
  const touch = isTouchDevice()
  if (!focus || overlay) return null
  let label = focus.label
  if (focus.kind === 'cake') label = cakeOut ? 'Relight the candles' : 'Make a wish and blow out the candles'
  if (focus.kind === 'portal') label = letter ? 'Read the letter again' : 'Answer the portal'
  return (
    <div className="prompt">
      {focus.kind === 'portal' && !letter && (
        <div className="clue-card" data-testid="portal-clue">
          <small>The portal whispers</small>
          {portal?.clue ?? 'The portal needs a connection to speak.'}
        </div>
      )}
      {!touch && (
        <button className="pill" onClick={interact} data-testid="interact-prompt">
          <span className="key">E</span>
          {label}
        </button>
      )}
    </div>
  )
}

function ControlsHint() {
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = window.setTimeout(() => setShow(false), 9000)
    return () => window.clearTimeout(t)
  }, [])
  if (isTouchDevice()) return null
  return (
    <div className={`controls-hint pill ${show ? '' : 'hide'}`}>
      <span className="key" style={{ background: 'var(--ink)', color: '#fff', borderRadius: 6, padding: '0 6px' }}>
        WASD
      </span>
      walk · <b>Shift</b> run · <b>drag</b> to look · <span className="key" style={{ background: 'var(--ink)', color: '#fff', borderRadius: 6, padding: '0 6px' }}>E</span> interact
    </div>
  )
}

function Toasts() {
  const toasts = useStore((s) => s.toasts)
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`pill toast ${t.tone ?? ''}`}>
          <span className="dot on" />
          {t.text}
        </div>
      ))}
    </div>
  )
}

export function Hud() {
  const muted = useStore((s) => s.settings.muted)
  const setSettings = useStore((s) => s.setSettings)
  const open = useStore((s) => s.openOverlay)
  const isOwner = useStore((s) => s.identity?.isOwner)
  const role = useStore((s) => s.identity?.role)
  const superseded = useStore((s) => s.superseded)
  useEffect(() => setMuted(muted), [muted])
  if (superseded) return <Superseded />
  return (
    <div className="hud">
      <div className="hud-top">
        <Players />
        <div className="hud-buttons">
          {(isOwner || role === 'me') && (
            <button className="icon-btn" onClick={() => open({ type: 'editor' })} aria-label="Edit gallery and letter" title="Edit gallery and letter" data-testid="open-editor">
              <Icon.edit />
            </button>
          )}
          <button className="icon-btn" onClick={() => setSettings({ muted: !muted })} aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'} data-testid="mute">
            {muted ? <Icon.muted /> : <Icon.sound />}
          </button>
          <button className="icon-btn" onClick={() => open({ type: 'help' })} aria-label="Help" title="Help">
            <Icon.help />
          </button>
          <button className="icon-btn" onClick={() => open({ type: 'settings' })} aria-label="Settings" title="Settings" data-testid="open-settings">
            <Icon.gear />
          </button>
        </div>
      </div>
      <ControlsHint />
      <Toasts />
      <Prompt />
    </div>
  )
}

function Superseded() {
  const [busy, setBusy] = useState(false)
  return (
    <div className="overlay superseded" role="dialog" aria-modal="true">
      <div className="panel">
        <h2 style={{ margin: '0 0 0.6rem' }}>You are inside somewhere else</h2>
        <p className="hint" style={{ fontSize: '1rem' }}>
          Our Little World was opened with your role in another tab or on another device, so this one stepped aside to keep things tidy.
        </p>
        <div className="row" style={{ marginTop: '1.2rem' }}>
          <button
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              const ok = await room.reclaim()
              setBusy(false)
              if (ok) useStore.setState({ superseded: false })
            }}
          >
            Continue here
          </button>
        </div>
      </div>
    </div>
  )
}
