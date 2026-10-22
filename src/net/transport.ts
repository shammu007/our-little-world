import type { Role } from '../types'

export interface PresenceMeta {
  sessionId: string
  userId: string
  role: Role
  name: string
  joinedAt: number
}

export type TransportStatus = 'connecting' | 'joined' | 'reconnecting' | 'closed' | 'error'

export type BroadcastHandler = (event: string, payload: Record<string, unknown>) => void

/** Minimal realtime room abstraction implemented by Supabase Realtime and by a same-browser BroadcastChannel demo. */
export interface RoomTransport {
  join(meta: PresenceMeta): void
  leave(): Promise<void>
  send(event: string, payload: Record<string, unknown>): void
  onBroadcast(h: BroadcastHandler): void
  onPresence(h: (members: PresenceMeta[]) => void): void
  onStatus(h: (s: TransportStatus, detail?: string) => void): void
  /** Re-announce presence (after a tab becomes visible / network returns). */
  refresh(): void
}
