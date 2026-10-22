import type { BroadcastHandler, PresenceMeta, RoomTransport, TransportStatus } from './transport'

/**
 * Demo transport: synchronises tabs of the SAME browser using BroadcastChannel.
 * Presence is emulated with hello/heartbeat/bye messages and a timeout.
 */
export class LocalTransport implements RoomTransport {
  private ch: BroadcastChannel | null = null
  private me: PresenceMeta | null = null
  private members = new Map<string, { meta: PresenceMeta; seen: number }>()
  private bHandlers: BroadcastHandler[] = []
  private pHandlers: ((m: PresenceMeta[]) => void)[] = []
  private sHandlers: ((s: TransportStatus, d?: string) => void)[] = []
  private timer: number | undefined
  private onUnload = () => this.post({ k: 'bye', id: this.me?.sessionId })

  constructor(private roomId: string) {}

  join(meta: PresenceMeta) {
    this.me = meta
    if (typeof BroadcastChannel === 'undefined') {
      this.emitStatus('joined')
      this.emitPresence()
      return
    }
    this.ch = new BroadcastChannel(`olw-room-${this.roomId}`)
    this.ch.onmessage = (e) => this.handle(e.data)
    this.members.set(meta.sessionId, { meta, seen: Date.now() })
    this.post({ k: 'hello', meta, reply: true })
    this.timer = window.setInterval(() => {
      this.post({ k: 'hello', meta: this.me })
      const now = Date.now()
      let changed = false
      for (const [id, m] of this.members) {
        if (id !== this.me?.sessionId && now - m.seen > 6000) {
          this.members.delete(id)
          changed = true
        }
      }
      if (changed) this.emitPresence()
    }, 2000)
    window.addEventListener('pagehide', this.onUnload)
    queueMicrotask(() => {
      this.emitStatus('joined')
      this.emitPresence()
    })
  }

  private handle(msg: { k: string; [x: string]: unknown }) {
    if (msg.k === 'hello') {
      const meta = msg.meta as PresenceMeta
      const isNew = !this.members.has(meta.sessionId)
      this.members.set(meta.sessionId, { meta, seen: Date.now() })
      if (msg.reply && this.me) this.post({ k: 'hello', meta: this.me })
      if (isNew) this.emitPresence()
    } else if (msg.k === 'bye') {
      if (this.members.delete(msg.id as string)) this.emitPresence()
    } else if (msg.k === 'b') {
      for (const h of this.bHandlers) h(msg.event as string, msg.payload as Record<string, unknown>)
    }
  }

  private post(m: unknown) {
    try {
      this.ch?.postMessage(m)
    } catch {
      /* channel closed */
    }
  }
  private emitPresence() {
    const list = [...this.members.values()].map((m) => m.meta)
    for (const h of this.pHandlers) h(list)
  }
  private emitStatus(s: TransportStatus, d?: string) {
    for (const h of this.sHandlers) h(s, d)
  }

  async leave() {
    window.clearInterval(this.timer)
    window.removeEventListener('pagehide', this.onUnload)
    this.onUnload()
    this.ch?.close()
    this.ch = null
    this.members.clear()
    this.emitStatus('closed')
  }
  send(event: string, payload: Record<string, unknown>) {
    this.post({ k: 'b', event, payload })
  }
  onBroadcast(h: BroadcastHandler) {
    this.bHandlers.push(h)
  }
  onPresence(h: (m: PresenceMeta[]) => void) {
    this.pHandlers.push(h)
  }
  onStatus(h: (s: TransportStatus, d?: string) => void) {
    this.sHandlers.push(h)
  }
  refresh() {
    if (this.me) this.post({ k: 'hello', meta: this.me, reply: true })
  }
}
