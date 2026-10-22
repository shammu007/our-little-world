import { content, defaultPhotos, isExamplePath, resolveBundled } from '../content/content'
import { answerMatches } from '../lib/normalize'
import { idb } from '../lib/idb'
import { blobToDataUrl } from '../lib/image'
import { safeStorage, uid } from '../lib/device'
import { LocalTransport } from '../net/localTransport'
import type { Photo, PortalSecret, Role } from '../types'
import type { Backend, JoinResult, PhotoDraft, VerifyResult } from './types'

const K = {
  photos: 'olw.demo.photos',
  portal: 'olw.demo.portal',
  code: 'olw.demo.accessCode',
  id: (r: Role) => `olw.demo.identity.${r}`,
}

const store = safeStorage('local')
const read = <T,>(k: string): T | null => {
  try {
    const v = store?.getItem(k)
    return v ? (JSON.parse(v) as T) : null
  } catch {
    return null
  }
}
/** Returns false when the browser blocks storage (private mode, sandboxed previews). */
const write = (k: string, v: unknown) => {
  try {
    if (!store) return false
    store.setItem(k, JSON.stringify(v))
    return true
  } catch {
    return false
  }
}
const TEMP_NOTE = 'This browser is blocking storage here, so your photos show now but will be gone after closing the page. Open the file directly in Chrome, Edge or Safari to keep them.'

/**
 * Offline demo backend. Everything lives in this browser (localStorage + IndexedDB),
 * multiplayer works between tabs of the same browser. Nothing here is protected:
 * use Supabase for the real birthday.
 */
export class LocalBackend implements Backend {
  readonly mode = 'demo' as const
  private role: Role = 'me'
  /** Fallbacks used when localStorage / IndexedDB are blocked: edits last for this page visit. */
  private memPhotos: PhotoDraft[] | null = null
  private memBlobs = new Map<string, Blob>()
  private memPortal: PortalSecret | null = null
  storageWarning: string | null = null
  private attempts: number[] = []

  async init(role: Role) {
    this.role = role
    let id = store?.getItem(K.id(role))
    if (!id) {
      id = uid()
      store?.setItem(K.id(role), id)
    }
    return { userId: id }
  }

  private async demoPortal(): Promise<PortalSecret> {
    const saved = this.memPortal ?? read<PortalSecret>(K.portal)
    if (saved) return saved
    const { demoPortal } = await import('../content/demoSecrets')
    return demoPortal
  }

  private accessCode(): string {
    return store?.getItem(K.code) ?? content.demoAccessCode ?? ''
  }

  async accessCodeRequired() {
    return Boolean(this.accessCode())
  }

  async join(role: Role, _name: string, accessCode?: string): Promise<JoinResult> {
    const code = this.accessCode()
    if (code && !answerMatches(accessCode ?? '', [code])) return { ok: false, reason: 'bad_code', message: 'That access code does not match.' }
    const { userId } = await this.init(role)
    return { ok: true, userId, isOwner: role === 'me' }
  }
  async heartbeat() {
    return true
  }
  async leave() {}

  async loadPhotos(): Promise<Photo[]> {
    const saved = this.memPhotos ?? read<PhotoDraft[]>(K.photos)
    if (!saved || !saved.length) return defaultPhotos()
    const out: Photo[] = []
    for (const d of saved) {
      let src = d.storagePath.startsWith('bundle:') ? resolveBundled(d.storagePath) : d.storagePath
      if (d.storagePath.startsWith('idb:')) {
        const blob = this.memBlobs.get(d.storagePath) ?? (await idb.get(d.storagePath).catch(() => undefined))
        if (!blob) continue
        src = await blobToDataUrl(blob)
      }
      out.push({ id: d.id, src, caption: d.caption, wall: d.wall, order: d.order, aspect: d.aspect, storagePath: d.storagePath, placeholder: isExamplePath(d.storagePath) })
    }
    return out
  }

  async getPortalPublic() {
    const p = await this.demoPortal()
    return { clue: p.clue, hint: p.hint }
  }

  async verifyPortal(answer: string): Promise<VerifyResult> {
    const now = Date.now()
    this.attempts = this.attempts.filter((t) => now - t < 60_000)
    if (this.attempts.length >= 15) return { ok: false, rateLimited: true, message: 'Take a little breather and try again in a minute.' }
    this.attempts.push(now)
    const p = await this.demoPortal()
    if (answerMatches(answer, p.acceptedAnswers.length ? p.acceptedAnswers : ['\u0000'])) return { ok: true, letter: p.letter }
    return { ok: false, hint: p.hint }
  }

  async claimOwner() {
    return this.role === 'me'
  }
  async isOwner() {
    return this.role === 'me'
  }

  async uploadPhoto(blob: Blob) {
    const key = `idb:${uid()}`
    try {
      await idb.put(key, blob)
    } catch {
      this.storageWarning = TEMP_NOTE
    }
    this.memBlobs.set(key, blob)
    const previewUrl = await blobToDataUrl(blob)
    return { storagePath: key, previewUrl }
  }

  async savePhotos(photos: PhotoDraft[], removed: string[]) {
    this.memPhotos = photos
    if (!write(K.photos, photos)) this.storageWarning = TEMP_NOTE
    for (const p of removed) {
      this.memBlobs.delete(p)
      if (p.startsWith('idb:')) await idb.del(p).catch(() => undefined)
    }
  }

  async getPortalSecret() {
    return structuredClone(await this.demoPortal())
  }
  async savePortalSecret(secret: PortalSecret) {
    this.memPortal = secret
    if (!write(K.portal, secret)) this.storageWarning = TEMP_NOTE
  }
  async setAccessCode(code: string | null) {
    if (code) store?.setItem(K.code, code)
    else store?.setItem(K.code, '')
  }

  createTransport(roomId: string) {
    return new LocalTransport(roomId)
  }
}
