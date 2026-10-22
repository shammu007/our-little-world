import { content, placeholderPhotos, resolveBundled } from '../content/content'
import { answerMatches } from '../lib/normalize'
import { idb } from '../lib/idb'
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
const write = (k: string, v: unknown) => {
  try {
    store?.setItem(k, JSON.stringify(v))
  } catch {
    throw new Error('This browser blocked local storage, so demo edits cannot be saved.')
  }
}

/**
 * Offline demo backend. Everything lives in this browser (localStorage + IndexedDB),
 * multiplayer works between tabs of the same browser. Nothing here is protected:
 * use Supabase for the real birthday.
 */
export class LocalBackend implements Backend {
  readonly mode = 'demo' as const
  private role: Role = 'me'
  private objectUrls: string[] = []
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
    const saved = read<PortalSecret>(K.portal)
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
    const saved = read<PhotoDraft[]>(K.photos)
    if (!saved || !saved.length) return placeholderPhotos
    this.objectUrls.forEach((u) => URL.revokeObjectURL(u))
    this.objectUrls = []
    const out: Photo[] = []
    for (const d of saved) {
      let src = d.storagePath.startsWith('bundle:') ? resolveBundled(d.storagePath) : d.storagePath
      if (d.storagePath.startsWith('idb:')) {
        const blob = await idb.get(d.storagePath).catch(() => undefined)
        if (!blob) continue
        src = URL.createObjectURL(blob)
        this.objectUrls.push(src)
      }
      out.push({ id: d.id, src, caption: d.caption, wall: d.wall, order: d.order, aspect: d.aspect, storagePath: d.storagePath, placeholder: !d.storagePath.startsWith('idb:') })
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
    await idb.put(key, blob)
    const previewUrl = URL.createObjectURL(blob)
    this.objectUrls.push(previewUrl)
    return { storagePath: key, previewUrl }
  }

  async savePhotos(photos: PhotoDraft[], removed: string[]) {
    write(K.photos, photos)
    for (const p of removed) if (p.startsWith('idb:')) await idb.del(p).catch(() => undefined)
  }

  async getPortalSecret() {
    return structuredClone(await this.demoPortal())
  }
  async savePortalSecret(secret: PortalSecret) {
    write(K.portal, secret)
  }
  async setAccessCode(code: string | null) {
    if (code) store?.setItem(K.code, code)
    else store?.setItem(K.code, '')
  }

  createTransport(roomId: string) {
    return new LocalTransport(roomId)
  }
}
