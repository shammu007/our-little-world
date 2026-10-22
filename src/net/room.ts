import { PoseBuffer } from '../lib/interp'
import { useStore, type Identity, type RemoteInfo } from '../state/store'
import type { Backend } from '../backend/types'
import type { AnimState, Role } from '../types'
import type { PresenceMeta, RoomTransport } from './transport'

const ROLES: Role[] = ['me', 'sweetheart']

/** Remote players' pose buffers, read by the 3D scene every frame. */
export const remoteBuffers = new Map<string, PoseBuffer>()

/**
 * The active session for each role is the most recently joined one. An older
 * session for the same role is "superseded" (opened again on another tab or
 * device) and goes quiet. This keeps at most two live participants.
 */
export function activeSessions(members: PresenceMeta[]): Map<Role, PresenceMeta> {
  const out = new Map<Role, PresenceMeta>()
  for (const m of members) {
    if (!ROLES.includes(m.role)) continue
    const cur = out.get(m.role)
    if (!cur || m.joinedAt > cur.joinedAt || (m.joinedAt === cur.joinedAt && m.sessionId > cur.sessionId)) out.set(m.role, m)
  }
  return out
}

class Room {
  private transport: RoomTransport | null = null
  private backend: Backend | null = null
  private me: Identity | null = null
  private meta: PresenceMeta | null = null
  private lastSent = 0
  private lastPose: number[] = []
  private heartbeatTimer: number | undefined
  private wasOnline = false
  private roomId = ''

  async start(backend: Backend, me: Identity, roomId: string) {
    await this.stop()
    this.backend = backend
    this.me = me
    this.roomId = roomId
    this.meta = { sessionId: me.sessionId, userId: me.userId, role: me.role, name: me.name, joinedAt: Date.now() }
    const t = backend.createTransport(roomId)
    this.transport = t
    useStore.setState({ conn: 'connecting', superseded: false, remotes: [] })

    t.onStatus((s) => {
      if (s === 'joined') {
        useStore.setState({ conn: 'online' })
        // ask whoever is already here for the shared world state
        t.send('state_req', { from: me.sessionId })
        if (this.wasOnline) useStore.getState().toast('Reconnected')
        this.wasOnline = true
      } else if (s === 'reconnecting' || s === 'connecting') useStore.setState({ conn: s === 'connecting' ? 'connecting' : 'reconnecting' })
      else if (s === 'error') useStore.setState({ conn: 'error' })
    })
    t.onPresence((members) => this.handlePresence(members))
    t.onBroadcast((ev, p) => this.handleBroadcast(ev, p))
    t.join(this.meta)

    document.addEventListener('visibilitychange', this.onVisible)
    window.addEventListener('online', this.onOnline)
    window.addEventListener('pagehide', this.onPageHide)
    this.heartbeatTimer = window.setInterval(async () => {
      if (!this.backend || useStore.getState().superseded) return
      const ok = await this.backend.heartbeat()
      if (!ok) this.supersede()
    }, 30_000)
  }

  async stop() {
    window.clearInterval(this.heartbeatTimer)
    document.removeEventListener('visibilitychange', this.onVisible)
    window.removeEventListener('online', this.onOnline)
    window.removeEventListener('pagehide', this.onPageHide)
    if (this.transport) {
      this.transport.send('bye', { from: this.me?.sessionId })
      await this.transport.leave()
    }
    this.transport = null
    remoteBuffers.clear()
    this.wasOnline = false
  }

  /** Take over again after being superseded ("Continue here"). */
  async reclaim() {
    if (!this.backend || !this.me) return false
    const res = await this.backend.join(this.me.role, this.me.name)
    if (!res.ok) {
      useStore.getState().toast(res.message, 'warn')
      return false
    }
    await this.start(this.backend, this.me, this.roomId)
    return true
  }

  private supersede() {
    useStore.setState({ superseded: true })
    void this.stop()
  }

  private onVisible = () => {
    if (document.visibilityState === 'visible') this.transport?.refresh()
  }
  private onOnline = () => this.transport?.refresh()
  private onPageHide = () => this.transport?.send('bye', { from: this.me?.sessionId })

  private handlePresence(members: PresenceMeta[]) {
    if (!this.me) return
    const active = activeSessions(members)
    const mine = active.get(this.me.role)
    if (mine && mine.sessionId !== this.me.sessionId && this.meta && mine.joinedAt > this.meta.joinedAt) {
      this.supersede()
      return
    }
    const remotes: RemoteInfo[] = []
    for (const [role, m] of active) {
      if (role === this.me.role) continue
      remotes.push({ sessionId: m.sessionId, userId: m.userId, role: m.role, name: m.name })
      if (!remoteBuffers.has(m.sessionId)) remoteBuffers.set(m.sessionId, new PoseBuffer())
    }
    const prev = useStore.getState().remotes
    for (const r of remotes) if (!prev.some((p) => p.sessionId === r.sessionId)) useStore.getState().toast(`${r.name} entered the world`)
    for (const p of prev)
      if (!remotes.some((r) => r.sessionId === p.sessionId)) {
        remoteBuffers.delete(p.sessionId)
        useStore.getState().toast(`${p.name} left for now`)
      }
    useStore.setState({ remotes })
    // a newcomer will have asked for state; make sure they also get our pose quickly
    this.lastSent = 0
  }

  private handleBroadcast(ev: string, p: Record<string, unknown>) {
    const s = useStore.getState()
    if (ev === 'pose') {
      const id = p.s as string
      const buf = remoteBuffers.get(id)
      if (!buf) return
      const pos = p.p as [number, number, number]
      if (!Array.isArray(pos) || pos.length !== 3 || pos.some((n) => typeof n !== 'number' || !isFinite(n))) return
      const sample = { t: performance.now(), p: pos, yaw: Number(p.y) || 0, anim: String(p.a ?? 'idle'), speed: Number(p.v) || 0 }
      const last = buf.samples[buf.samples.length - 1]
      if (!last || Math.hypot(last.p[0] - pos[0], last.p[2] - pos[2]) > 8) buf.reset(sample)
      else buf.push(sample)
    } else if (ev === 'cake') {
      this.applyCake(Boolean(p.out), Number(p.rev) || 0, String(p.by ?? ''), true)
    } else if (ev === 'state_req') {
      if (s.cake.rev > 0) this.transport?.send('state', { cake: s.cake })
      this.lastSent = 0
    } else if (ev === 'state') {
      const c = p.cake as { out: boolean; rev: number; by: string } | undefined
      if (c) this.applyCake(Boolean(c.out), Number(c.rev) || 0, String(c.by ?? ''), false)
    } else if (ev === 'portal') {
      useStore.setState({ portalSeq: s.portalSeq + 1 })
    } else if (ev === 'bye') {
      const id = p.from as string
      if (s.remotes.some((r) => r.sessionId === id)) {
        // presence will confirm shortly; hide immediately for snappier feel
        remoteBuffers.delete(id)
        useStore.setState({ remotes: s.remotes.filter((r) => r.sessionId !== id) })
      }
    }
  }

  /** Last-writer-wins with revision numbers; ties broken by session id so every client converges. */
  private applyCake(out: boolean, rev: number, by: string, animate: boolean) {
    const s = useStore.getState()
    const cur = s.cake
    if (rev < cur.rev || (rev === cur.rev && by <= cur.by)) return
    const blown = out && !cur.out
    useStore.setState({ cake: { out, rev, by }, blowSeq: blown && animate ? s.blowSeq + 1 : s.blowSeq })
  }

  setCake(out: boolean) {
    const s = useStore.getState()
    const cake = { out, rev: s.cake.rev + 1, by: this.me?.sessionId ?? 'local' }
    useStore.setState({ cake, blowSeq: out ? s.blowSeq + 1 : s.blowSeq })
    this.transport?.send('cake', cake)
  }

  portalOpened() {
    this.transport?.send('portal', { by: this.me?.sessionId })
  }

  /** Called every frame by the player; throttled to ~12 Hz while moving, 1 Hz while idle. */
  publishPose(p: [number, number, number], yaw: number, anim: AnimState, speed: number) {
    if (!this.transport || useStore.getState().superseded) return
    const now = performance.now()
    const moved =
      !this.lastPose.length ||
      Math.abs(this.lastPose[0] - p[0]) + Math.abs(this.lastPose[1] - p[1]) + Math.abs(this.lastPose[2] - p[2]) > 0.01 ||
      Math.abs(this.lastPose[3] - yaw) > 0.02
    const interval = moved ? 80 : 1000
    if (now - this.lastSent < interval) return
    this.lastSent = now
    this.lastPose = [p[0], p[1], p[2], yaw]
    const r = (n: number) => Math.round(n * 100) / 100
    this.transport.send('pose', { s: this.me?.sessionId, p: [r(p[0]), r(p[1]), r(p[2])], y: r(yaw), a: anim, v: r(speed) })
  }
}

export const room = new Room()
