import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { defaultPhotos, isExamplePath, resolveBundled } from '../content/content'
import { uid } from '../lib/device'
import { SupabaseTransport } from '../net/supabaseTransport'
import type { Letter, Photo, PortalSecret, Role, Wall } from '../types'
import type { Backend, JoinResult, PhotoDraft, VerifyResult } from './types'

const BUCKET = 'gallery'
const SIGNED_URL_TTL = 60 * 60 * 6

interface PhotoRow {
  id: string
  storage_path: string
  caption: string
  wall: Wall
  sort_order: number
  aspect: number
}

function friendly(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? String(err)
  if (/fetch|network|Failed to fetch|NetworkError/i.test(msg)) return 'We could not reach the server. Check the connection and try again.'
  if (/anonymous/i.test(msg)) return 'Anonymous sign-ins are disabled in Supabase (Authentication → Sign In / Providers → Allow anonymous sign-ins).'
  return msg
}

/** Supabase backend: anonymous auth, RPCs guarded by RLS, private storage, Realtime. */
export class SupabaseBackend implements Backend {
  readonly mode = 'supabase' as const
  readonly sb: SupabaseClient

  constructor(url: string, key: string) {
    this.sb = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'olw-auth', detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 20 } },
    })
  }

  async init(_role: Role) {
    const { data } = await this.sb.auth.getSession()
    if (data.session?.user) return { userId: data.session.user.id }
    const { data: signed, error } = await this.sb.auth.signInAnonymously()
    if (error || !signed.user) throw new Error(friendly(error ?? 'Sign-in failed'))
    return { userId: signed.user.id }
  }

  async accessCodeRequired() {
    const { data, error } = await this.sb.rpc('room_info')
    if (error) return null
    return Boolean((data as { access_code_required?: boolean })?.access_code_required)
  }

  async join(role: Role, displayName: string, accessCode?: string): Promise<JoinResult> {
    try {
      const { userId } = await this.init(role)
      const { data, error } = await this.sb.rpc('join_room', { p_role: role, p_access_code: accessCode || null, p_display_name: displayName })
      if (error) return { ok: false, reason: 'network', message: friendly(error) }
      const r = data as { ok: boolean; reason?: string; is_owner?: boolean }
      if (r.ok) return { ok: true, userId, isOwner: Boolean(r.is_owner) }
      if (r.reason === 'bad_code') return { ok: false, reason: 'bad_code', message: 'That access code does not match.' }
      if (r.reason === 'rate_limited') return { ok: false, reason: 'rate_limited', message: 'Too many tries. Please wait a few minutes.' }
      if (r.reason === 'slot_busy')
        return {
          ok: false,
          reason: 'slot_busy',
          message: 'Someone is already inside with this role on another device. If that was you, close it and try again in about a minute.',
        }
      return { ok: false, reason: 'network', message: r.reason ?? 'Could not join.' }
    } catch (e) {
      return { ok: false, reason: 'network', message: friendly(e) }
    }
  }

  async heartbeat() {
    const { data, error } = await this.sb.rpc('heartbeat')
    if (error) return true // transient; don't kick the player on a network blip
    return Boolean(data)
  }

  async leave() {
    await this.sb.rpc('leave_room').then(
      () => undefined,
      () => undefined,
    )
  }

  async loadPhotos(): Promise<Photo[]> {
    const { data, error } = await this.sb.from('photos').select('id,storage_path,caption,wall,sort_order,aspect').order('sort_order')
    if (error) throw new Error(friendly(error))
    const rows = (data ?? []) as PhotoRow[]
    if (!rows.length) return defaultPhotos()
    const storagePaths = rows.map((r) => r.storage_path).filter((p) => !p.startsWith('bundle:'))
    const signed = new Map<string, string>()
    if (storagePaths.length) {
      const { data: urls, error: e2 } = await this.sb.storage.from(BUCKET).createSignedUrls(storagePaths, SIGNED_URL_TTL)
      if (e2) throw new Error(friendly(e2))
      for (const u of urls ?? []) if (u.signedUrl && u.path) signed.set(u.path, u.signedUrl)
    }
    return rows
      .map((r) => ({
        id: r.id,
        src: r.storage_path.startsWith('bundle:') ? resolveBundled(r.storage_path) : signed.get(r.storage_path) ?? '',
        caption: r.caption,
        wall: r.wall,
        order: r.sort_order,
        aspect: r.aspect,
        storagePath: r.storage_path,
        placeholder: isExamplePath(r.storage_path),
      }))
      .filter((p) => p.src)
  }

  async getPortalPublic() {
    const { data, error } = await this.sb.from('portal_public').select('clue,hint').maybeSingle()
    if (error) throw new Error(friendly(error))
    return { clue: data?.clue ?? 'The portal is quiet for now.', hint: data?.hint ?? '' }
  }

  async verifyPortal(answer: string): Promise<VerifyResult> {
    const { data, error } = await this.sb.rpc('verify_portal', { p_answer: answer })
    if (error) return { ok: false, message: friendly(error) }
    const r = data as { ok: boolean; letter?: Letter; hint?: string; reason?: string }
    if (r.ok && r.letter) return { ok: true, letter: r.letter }
    if (r.reason === 'rate_limited') return { ok: false, rateLimited: true, message: 'Take a little breather and try again in a few minutes.' }
    return { ok: false, hint: r.hint }
  }

  async claimOwner(code: string) {
    const { data, error } = await this.sb.rpc('claim_owner', { p_code: code })
    if (error) throw new Error(friendly(error))
    return Boolean(data)
  }

  async isOwner() {
    const { data, error } = await this.sb.rpc('am_owner')
    return !error && Boolean(data)
  }

  async uploadPhoto(blob: Blob) {
    const path = `photos/${uid()}.jpg`
    const { error } = await this.sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false, cacheControl: '3600' })
    if (error) throw new Error(friendly(error))
    return { storagePath: path, previewUrl: URL.createObjectURL(blob) }
  }

  async savePhotos(photos: PhotoDraft[], removed: string[]) {
    const rows = photos.map((p) => ({ id: p.id, storage_path: p.storagePath, caption: p.caption.slice(0, 280), wall: p.wall, sort_order: p.order, aspect: p.aspect }))
    const { error } = await this.sb.rpc('owner_save_photos', { p_photos: rows })
    if (error) throw new Error(friendly(error))
    const toRemove = removed.filter((p) => !p.startsWith('bundle:'))
    if (toRemove.length) await this.sb.storage.from(BUCKET).remove(toRemove)
  }

  async getPortalSecret(): Promise<PortalSecret> {
    const { data, error } = await this.sb.rpc('owner_get_portal')
    if (error) throw new Error(friendly(error))
    const r = data as { clue: string; hint: string; accepted_answers: string[]; letter: Letter }
    return { clue: r.clue, hint: r.hint, acceptedAnswers: r.accepted_answers ?? [], letter: r.letter }
  }

  async savePortalSecret(s: PortalSecret) {
    const { error } = await this.sb.rpc('owner_save_portal', { p_clue: s.clue, p_hint: s.hint, p_answers: s.acceptedAnswers, p_letter: s.letter })
    if (error) throw new Error(friendly(error))
  }

  async setAccessCode(code: string | null) {
    const { error } = await this.sb.rpc('owner_set_access_code', { p_code: code })
    if (error) throw new Error(friendly(error))
  }

  createTransport(roomId: string) {
    return new SupabaseTransport(this.sb, roomId, true)
  }
}
