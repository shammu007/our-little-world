import { useEffect, useState } from 'react'
import { getBackend } from '../backend'
import type { PhotoDraft } from '../backend/types'
import { resolveBundled } from '../content/content'
import { prepareImage } from '../lib/image'
import { GALLERY_LIMITS } from '../lib/layout'
import { uid } from '../lib/device'
import { reloadPhotos } from '../session'
import { useStore } from '../state/store'
import type { PortalSecret, Wall } from '../types'
import { Icon } from './icons'

type Draft = PhotoDraft & { preview: string }
const WALLS: { id: Wall; label: string }[] = [
  { id: 'left', label: 'Left wall' },
  { id: 'back', label: 'Main wall' },
  { id: 'right', label: 'Right wall' },
]

function OwnerGate({ onOk }: { onOk: () => void }) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setErr('')
        try {
          const ok = await (await getBackend()).claimOwner(code)
          if (ok) {
            const id = useStore.getState().identity
            if (id) useStore.getState().setIdentity({ ...id, isOwner: true })
            onOk()
          } else setErr('That owner code is not right.')
        } catch (e2) {
          setErr((e2 as Error).message)
        }
        setBusy(false)
      }}
    >
      <p className="hint" style={{ margin: 0 }}>
        Only the owner can edit photos and the letter. Enter the owner code you set during setup. It is checked on the server and remembered for this browser.
      </p>
      <input className="input" type="password" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Owner code" aria-label="Owner code" />
      {err && <p className="hint warm" style={{ margin: 0 }}>{err}</p>}
      <div className="row">
        <button className="btn" disabled={busy || !code}>
          Unlock editor
        </button>
      </div>
    </form>
  )
}

function PhotosTab() {
  const photos = useStore((s) => s.photos)
  const toast = useStore((s) => s.toast)
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    photos.map((p) => ({ id: p.id.startsWith('placeholder-') ? uid() : p.id, caption: p.caption, wall: p.wall, order: p.order, aspect: p.aspect, storagePath: p.storagePath ?? '', preview: p.src })),
  )
  const [removed, setRemoved] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const byWall = (w: Wall) => drafts.filter((d) => d.wall === w).sort((a, b) => a.order - b.order)
  const renumber = (list: Draft[]) => {
    const out: Draft[] = []
    for (const w of WALLS) byWallOf(list, w.id).forEach((d, i) => out.push({ ...d, order: i }))
    return out
  }
  const byWallOf = (list: Draft[], w: Wall) => list.filter((d) => d.wall === w).sort((a, b) => a.order - b.order)
  const update = (id: string, patch: Partial<Draft>) => {
    setDirty(true)
    setDrafts((ds) => renumber(ds.map((d) => (d.id === id ? { ...d, ...patch, order: patch.wall && patch.wall !== d.wall ? 999 : patch.order ?? d.order } : d))))
  }
  const move = (d: Draft, dir: -1 | 1) => {
    const list = byWall(d.wall)
    const i = list.findIndex((x) => x.id === d.id)
    const j = i + dir
    if (j < 0 || j >= list.length) return
    const other = list[j]
    setDirty(true)
    setDrafts((ds) => renumber(ds.map((x) => (x.id === d.id ? { ...x, order: other.order } : x.id === other.id ? { ...x, order: d.order } : x))))
  }
  const remove = (d: Draft) => {
    setDirty(true)
    if (d.storagePath && !d.isNew) setRemoved((r) => [...r, d.storagePath])
    setDrafts((ds) => renumber(ds.filter((x) => x.id !== d.id)))
  }

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    const backend = await getBackend()
    for (const file of Array.from(files)) {
      if (drafts.length >= GALLERY_LIMITS.hardMax) {
        toast(`The hall fits at most ${GALLERY_LIMITS.hardMax} photos.`, 'warn')
        break
      }
      setBusy(`Uploading ${file.name}…`)
      try {
        const img = await prepareImage(file)
        const { storagePath, previewUrl } = await backend.uploadPhoto(img.blob)
        const counts = WALLS.map((w) => byWall(w.id).length)
        const wall = WALLS[counts.indexOf(Math.min(...counts))].id
        setDrafts((ds) => renumber([...ds, { id: uid(), caption: '', wall, order: 999, aspect: img.aspect, storagePath, preview: previewUrl, isNew: true }]))
        setDirty(true)
      } catch (e) {
        toast((e as Error).message, 'warn')
      }
    }
    setBusy(null)
  }

  const save = async () => {
    setBusy('Saving…')
    try {
      const backend = await getBackend()
      await backend.savePhotos(
        drafts.map(({ preview: _p, ...d }) => d),
        removed,
      )
      await reloadPhotos()
      setDirty(false)
      setRemoved([])
      toast('Gallery saved')
    } catch (e) {
      toast((e as Error).message, 'warn')
    }
    setBusy(null)
  }

  const count = drafts.length
  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.8rem', alignItems: 'center' }}>
        <span className={`badge ${count < GALLERY_LIMITS.min || count > GALLERY_LIMITS.max ? 'warn' : ''}`}>
          {count} photos · best between {GALLERY_LIMITS.min} and {GALLERY_LIMITS.max}
        </span>
        <label className="btn small" style={{ display: 'inline-flex', alignItems: 'center' }}>
          Upload photos
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => upload(e.target.files)} data-testid="upload-input" />
        </label>
      </div>
      {WALLS.map((w) => (
        <section key={w.id} style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: '0.4rem 0', fontSize: '1rem' }}>
            {w.label} <span className="hint">({byWall(w.id).length}{w.id === 'back' ? ', split around the portal' : ''})</span>
          </h3>
          <div className="photo-rows">
            {byWall(w.id).map((d, i, list) => (
              <div className="photo-row" key={d.id}>
                <img src={d.storagePath.startsWith('bundle:') ? resolveBundled(d.storagePath) : d.preview} alt="" />
                <div className="meta">
                  <input className="input" value={d.caption} maxLength={280} placeholder="Caption" aria-label="Caption" onChange={(e) => update(d.id, { caption: e.target.value })} />
                  <div className="line">
                    <select className="input" style={{ width: 'auto' }} value={d.wall} aria-label="Wall" onChange={(e) => update(d.id, { wall: e.target.value as Wall })}>
                      {WALLS.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.label}
                        </option>
                      ))}
                    </select>
                    {d.storagePath.startsWith('bundle:') && <span className="badge warn">example</span>}
                  </div>
                </div>
                <div className="ops">
                  <button className="mini" disabled={i === 0} onClick={() => move(d, -1)} aria-label="Move earlier">
                    ↑
                  </button>
                  <button className="mini" disabled={i === list.length - 1} onClick={() => move(d, 1)} aria-label="Move later">
                    ↓
                  </button>
                  <button className="mini" onClick={() => remove(d)} aria-label="Remove photo">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
      <div className="editor-bar">
        <span className="hint">{busy ?? (dirty ? 'Unsaved changes' : 'Everything is saved')}</span>
        <button className="btn" onClick={save} disabled={!!busy || !dirty} data-testid="save-photos">
          Save gallery
        </button>
      </div>
    </div>
  )
}

function PortalTab() {
  const toast = useStore((s) => s.toast)
  const [secret, setSecret] = useState<PortalSecret | null>(null)
  const [answers, setAnswers] = useState('')
  const [body, setBody] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    getBackend()
      .then((b) => b.getPortalSecret())
      .then((s) => {
        setSecret(s)
        setAnswers(s.acceptedAnswers.join('\n'))
        setBody(s.letter.paragraphs.join('\n\n'))
      })
      .catch((e) => setErr((e as Error).message))
  }, [])
  if (err) return <p className="hint warm">{err}</p>
  if (!secret) return <p className="hint">Loading…</p>
  const set = (patch: Partial<PortalSecret>) => setSecret({ ...secret, ...patch })
  const setLetter = (patch: Partial<PortalSecret['letter']>) => setSecret({ ...secret, letter: { ...secret.letter, ...patch } })
  const save = async () => {
    const acceptedAnswers = answers
      .split(/\n|,/)
      .map((a) => a.trim())
      .filter(Boolean)
    if (!acceptedAnswers.length) {
      toast('Add at least one accepted answer.', 'warn')
      return
    }
    setBusy(true)
    try {
      const next = { ...secret, acceptedAnswers, letter: { ...secret.letter, paragraphs: body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) } }
      await (await getBackend()).savePortalSecret(next)
      useStore.setState({ portal: { clue: next.clue, hint: next.hint }, letter: null })
      toast('Portal and letter saved')
    } catch (e) {
      toast((e as Error).message, 'warn')
    }
    setBusy(false)
  }
  return (
    <div className="stack">
      <div className="field">
        <label htmlFor="clue">Clue shown near the portal</label>
        <textarea id="clue" className="input" rows={2} value={secret.clue} onChange={(e) => set({ clue: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="hint">Hint after a few wrong tries</label>
        <input id="hint" className="input" value={secret.hint} onChange={(e) => set({ hint: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="answers">Accepted answers (one per line, case and punctuation ignored)</label>
        <textarea id="answers" className="input" rows={3} value={answers} onChange={(e) => setAnswers(e.target.value)} />
      </div>
      <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
      <div className="field">
        <label htmlFor="ltitle">Letter title</label>
        <input id="ltitle" className="input" value={secret.letter.title} onChange={(e) => setLetter({ title: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="greet">Greeting</label>
        <input id="greet" className="input" value={secret.letter.greeting} onChange={(e) => setLetter({ greeting: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="body">Letter (blank line between paragraphs)</label>
        <textarea id="body" className="input" rows={9} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="sig">Signature</label>
        <input id="sig" className="input" value={secret.letter.signature} onChange={(e) => setLetter({ signature: e.target.value })} />
      </div>
      <div className="editor-bar">
        <span className="hint">The letter is only sent to a visitor after a correct answer{import.meta.env.VITE_SUPABASE_URL ? '.' : ' (in Supabase mode).'}</span>
        <button className="btn" onClick={save} disabled={busy}>
          Save portal & letter
        </button>
      </div>
    </div>
  )
}

function AccessTab() {
  const toast = useStore((s) => s.toast)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const apply = async (value: string | null) => {
    setBusy(true)
    try {
      await (await getBackend()).setAccessCode(value)
      toast(value ? 'Access code updated' : 'Access code removed')
      setCode('')
    } catch (e) {
      toast((e as Error).message, 'warn')
    }
    setBusy(false)
  }
  return (
    <div className="stack">
      <p className="hint" style={{ margin: 0 }}>
        An optional shared code that visitors type at the entrance. It is checked on the server and stored hashed. It keeps strangers with the link out of the
        two participant slots, but it is a light lock, not bank-grade security.
      </p>
      <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="New access code" aria-label="New access code" />
      <div className="row" style={{ justifyContent: 'flex-start' }}>
        <button className="btn" disabled={busy || code.trim().length < 3} onClick={() => apply(code.trim())}>
          Set code
        </button>
        <button className="btn ghost" disabled={busy} onClick={() => apply(null)}>
          Remove code
        </button>
      </div>
    </div>
  )
}

export default function Editor() {
  const close = useStore((s) => s.closeOverlay)
  const isOwner = useStore((s) => s.identity?.isOwner)
  const [owner, setOwner] = useState<boolean | null>(isOwner ? true : null)
  const [tab, setTab] = useState<'photos' | 'portal' | 'access'>('photos')
  useEffect(() => {
    if (owner !== null) return
    getBackend()
      .then((b) => b.isOwner())
      .then(setOwner)
      .catch(() => setOwner(false))
  }, [owner])
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [close])
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Gallery editor">
      <div className="panel wide" data-testid="editor">
        <button className="close" onClick={close} aria-label="Close">
          <Icon.close />
        </button>
        <h2>Edit our little world</h2>
        {owner === null && <p className="hint">Checking…</p>}
        {owner === false && <OwnerGate onOk={() => setOwner(true)} />}
        {owner && (
          <>
            <div className="tabs" role="tablist">
              {(
                [
                  ['photos', 'Photos'],
                  ['portal', 'Portal & letter'],
                  ['access', 'Access code'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </div>
            {tab === 'photos' && <PhotosTab />}
            {tab === 'portal' && <PortalTab />}
            {tab === 'access' && <AccessTab />}
          </>
        )}
      </div>
    </div>
  )
}
