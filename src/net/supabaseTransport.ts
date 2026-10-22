import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import type { BroadcastHandler, PresenceMeta, RoomTransport, TransportStatus } from './transport'

const EVENTS = ['pose', 'cake', 'state_req', 'state', 'portal', 'bye']

/**
 * Supabase Realtime transport: Presence for who is online, Broadcast for
 * fast ephemeral updates. Uses a private channel so only room members
 * (checked by RLS on realtime.messages) can join.
 */
export class SupabaseTransport implements RoomTransport {
  private channel: RealtimeChannel | null = null
  private me: PresenceMeta | null = null
  private bHandlers: BroadcastHandler[] = []
  private pHandlers: ((m: PresenceMeta[]) => void)[] = []
  private sHandlers: ((s: TransportStatus, d?: string) => void)[] = []
  private retry = 0
  private retryTimer: number | undefined
  private closed = false

  constructor(private sb: SupabaseClient, private roomId: string, private isPrivate = true) {}

  join(meta: PresenceMeta) {
    this.me = meta
    this.closed = false
    this.connect()
  }

  private async connect() {
    if (this.closed || !this.me) return
    if (this.channel) {
      await this.sb.removeChannel(this.channel)
      this.channel = null
    }
    const { data } = await this.sb.auth.getSession()
    if (data.session) this.sb.realtime.setAuth(data.session.access_token)
    const ch = this.sb.channel(`room:${this.roomId}`, {
      config: { private: this.isPrivate, presence: { key: this.me.sessionId }, broadcast: { self: false, ack: false } },
    })
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<PresenceMeta>()
      const list: PresenceMeta[] = []
      for (const key of Object.keys(state)) {
        const metas = state[key]
        const latest = metas[metas.length - 1]
        if (latest?.sessionId) list.push({ sessionId: latest.sessionId, userId: latest.userId, role: latest.role, name: latest.name, joinedAt: latest.joinedAt })
      }
      for (const h of this.pHandlers) h(list)
    })
    for (const ev of EVENTS) {
      ch.on('broadcast', { event: ev }, (msg) => {
        for (const h of this.bHandlers) h(ev, (msg.payload ?? {}) as Record<string, unknown>)
      })
    }
    this.channel = ch
    this.emit(this.retry ? 'reconnecting' : 'connecting')
    ch.subscribe(async (status, err) => {
      if (ch !== this.channel) return
      if (status === 'SUBSCRIBED') {
        this.retry = 0
        if (this.me) await ch.track(this.me)
        this.emit('joined')
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.emit('reconnecting', err?.message)
        this.scheduleReconnect()
      } else if (status === 'CLOSED' && !this.closed) {
        this.emit('reconnecting')
        this.scheduleReconnect()
      }
    })
  }

  private scheduleReconnect() {
    window.clearTimeout(this.retryTimer)
    const delay = Math.min(15000, 1000 * 2 ** this.retry++) + Math.random() * 500
    this.retryTimer = window.setTimeout(() => this.connect(), delay)
  }

  private emit(s: TransportStatus, d?: string) {
    for (const h of this.sHandlers) h(s, d)
  }

  async leave() {
    this.closed = true
    window.clearTimeout(this.retryTimer)
    if (this.channel) {
      try {
        await this.channel.untrack()
      } catch {
        /* ignore */
      }
      await this.sb.removeChannel(this.channel)
    }
    this.channel = null
    this.emit('closed')
  }

  send(event: string, payload: Record<string, unknown>) {
    const ch = this.channel
    if (!ch || ch.state !== 'joined') return
    void ch.send({ type: 'broadcast', event, payload })
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
    if (this.closed) return
    if (!this.channel || this.channel.state !== 'joined') {
      this.retry = 0
      void this.connect()
    } else if (this.me) void this.channel.track(this.me)
  }
}
