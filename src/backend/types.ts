import type { Letter, Photo, PortalPublic, PortalSecret, Role, Wall } from '../types'
import type { RoomTransport } from '../net/transport'

export type JoinResult =
  | { ok: true; userId: string; isOwner: boolean }
  | { ok: false; reason: 'bad_code' | 'slot_busy' | 'network' | 'rate_limited' | 'not_configured'; message: string }

export type VerifyResult = { ok: true; letter: Letter } | { ok: false; hint?: string; rateLimited?: boolean; message?: string }

export interface PhotoDraft {
  id: string
  caption: string
  wall: Wall
  order: number
  aspect: number
  storagePath: string
  /** set for photos uploaded during this edit session */
  isNew?: boolean
}

export interface Backend {
  readonly mode: 'demo' | 'supabase'
  /** Sign in silently (anonymous identity). Never shows any UI. */
  init(role: Role): Promise<{ userId: string }>
  join(role: Role, displayName: string, accessCode?: string): Promise<JoinResult>
  /** Keep the participant slot alive. Returns false if the slot was taken by another device. */
  heartbeat(): Promise<boolean>
  leave(): Promise<void>
  /** Whether the server expects a shared access code (null = unknown). */
  accessCodeRequired(): Promise<boolean | null>

  loadPhotos(): Promise<Photo[]>
  getPortalPublic(): Promise<PortalPublic>
  verifyPortal(answer: string): Promise<VerifyResult>

  claimOwner(code: string): Promise<boolean>
  isOwner(): Promise<boolean>
  uploadPhoto(blob: Blob): Promise<{ storagePath: string; previewUrl: string }>
  savePhotos(photos: PhotoDraft[], removedStoragePaths: string[]): Promise<void>
  /** Set when edits only last until the page is closed (browser storage is blocked). */
  readonly storageWarning?: string | null
  getPortalSecret(): Promise<PortalSecret>
  savePortalSecret(secret: PortalSecret): Promise<void>
  setAccessCode(code: string | null): Promise<void>

  createTransport(roomId: string): RoomTransport
}
