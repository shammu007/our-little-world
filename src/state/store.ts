import { create } from 'zustand'
import { isLowEndDevice, prefersReducedMotion, safeStorage } from '../lib/device'
import type { AvatarLook, Letter, Photo, PortalPublic, Role } from '../types'

export type Phase = 'welcome' | 'loading' | 'playing'
export type Quality = 'high' | 'low'
export type ConnState = 'offline' | 'connecting' | 'online' | 'reconnecting' | 'error'

export type Overlay =
  | null
  | { type: 'photo'; photoId: string }
  | { type: 'portal' }
  | { type: 'letter' }
  | { type: 'editor' }
  | { type: 'settings' }
  | { type: 'help' }

export interface Interactable {
  id: string
  kind: 'photo' | 'cake' | 'portal'
  label: string
  position: [number, number, number]
  radius: number
  photoId?: string
}

export interface Identity {
  role: Role
  userId: string
  sessionId: string
  name: string
  look: AvatarLook
  isOwner: boolean
}

export interface RemoteInfo {
  sessionId: string
  userId: string
  role: Role
  name: string
}

export interface Toast {
  id: number
  text: string
  tone?: 'info' | 'warn'
}

interface Settings {
  muted: boolean
  reducedMotion: boolean
  quality: Quality
}

const ls = safeStorage('local')
const savedSettings = (() => {
  try {
    return JSON.parse(ls?.getItem('olw.settings') ?? 'null') as Partial<Settings> | null
  } catch {
    return null
  }
})()

interface State {
  phase: Phase
  identity: Identity | null
  settings: Settings
  worldReady: boolean
  focus: Interactable | null
  overlay: Overlay
  photos: Photo[]
  portal: PortalPublic | null
  letter: Letter | null
  /** shared cake state, last-writer-wins by revision */
  cake: { out: boolean; rev: number; by: string }
  /** increments whenever candles get blown out (local or remote) to trigger effects */
  blowSeq: number
  portalSeq: number
  portalNear: number
  remotes: RemoteInfo[]
  conn: ConnState
  superseded: boolean
  toasts: Toast[]
  setPhase(p: Phase): void
  setIdentity(i: Identity | null): void
  setSettings(s: Partial<Settings>): void
  setFocus(f: Interactable | null): void
  openOverlay(o: Overlay): void
  closeOverlay(): void
  toast(text: string, tone?: Toast['tone']): void
  dismissToast(id: number): void
}

let toastId = 0

export const useStore = create<State>((set, get) => ({
  phase: 'welcome',
  identity: null,
  settings: {
    muted: savedSettings?.muted ?? false,
    reducedMotion: savedSettings?.reducedMotion ?? prefersReducedMotion(),
    quality: savedSettings?.quality ?? (isLowEndDevice() ? 'low' : 'high'),
  },
  worldReady: false,
  focus: null,
  overlay: null,
  photos: [],
  portal: null,
  letter: null,
  cake: { out: false, rev: 0, by: '' },
  blowSeq: 0,
  portalSeq: 0,
  portalNear: 0,
  remotes: [],
  conn: 'offline',
  superseded: false,
  toasts: [],
  setPhase: (phase) => set({ phase }),
  setIdentity: (identity) => set({ identity }),
  setSettings: (s) => {
    const settings = { ...get().settings, ...s }
    try {
      ls?.setItem('olw.settings', JSON.stringify(settings))
    } catch {
      /* ignore */
    }
    set({ settings })
  },
  setFocus: (focus) => {
    const cur = get().focus
    if (cur?.id !== focus?.id) set({ focus })
  },
  openOverlay: (overlay) => set({ overlay }),
  closeOverlay: () => set({ overlay: null }),
  toast: (text, tone = 'info') => {
    const id = ++toastId
    set({ toasts: [...get().toasts.slice(-2), { id, text, tone }] })
    window.setTimeout(() => get().dismissToast(id), 4200)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

/** Mutable, non-reactive values updated every frame (kept out of React state on purpose). */
export const live = {
  playerPos: [0, 0.2, 33] as [number, number, number],
  playerYaw: Math.PI,
  cameraYaw: 0,
  cameraPos: [0, 0, 0] as [number, number, number],
  insideHouse: false,
  /** set to move the player instantly (used by tests / debug) */
  teleport: null as null | { x: number; z: number; yaw: number; camYaw?: number },
}
