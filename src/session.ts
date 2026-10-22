import { content, defaultPhotos, placeholderPhotos } from './content/content'
import { getBackend } from './backend'
import type { JoinResult } from './backend/types'
import { initAudio, startAmbience } from './lib/audio'
import { safeStorage, uid } from './lib/device'
import { env } from './lib/env'
import { room } from './net/room'
import { live, useStore } from './state/store'
import type { Role } from './types'
import { SPAWN } from './lib/layout'

/** One id per page load (not sessionStorage: duplicated tabs would share it). */
const tabSession = uid()

function resetPlayer() {
  live.playerPos = [...SPAWN]
  live.playerYaw = Math.PI
}

/** Joins the room, loads content and starts realtime. Never throws: failures return a friendly result. */
export async function enterWorld(role: Role, accessCode?: string): Promise<JoinResult> {
  initAudio()
  const s = useStore.getState()
  const cfg = content.roles[role]
  let backend
  try {
    backend = await getBackend()
  } catch {
    return { ok: false, reason: 'network', message: 'The app could not load part of itself. Check the connection and refresh.' }
  }
  const res = await backend.join(role, cfg.displayName, accessCode)
  if (!res.ok) return res

  resetPlayer()
  s.setIdentity({ role, userId: res.userId, sessionId: tabSession, name: cfg.displayName, look: cfg.avatar, isOwner: res.isOwner })
  useStore.setState({ phase: 'loading', worldReady: false, letter: null, overlay: null, cake: { out: false, rev: 0, by: '' } })

  const [photos, portal] = await Promise.allSettled([backend.loadPhotos(), backend.getPortalPublic()])
  useStore.setState({
    photos: photos.status === 'fulfilled' ? photos.value : await defaultPhotos(),
    portal: portal.status === 'fulfilled' ? portal.value : null,
  })
  if (photos.status === 'rejected') s.toast('The photos could not be loaded, showing examples for now.', 'warn')

  await room.start(backend, useStore.getState().identity!, env.roomId)
  safeStorage('local')?.setItem('olw.lastRole', role)
  startAmbience()
  return res
}

/** Fallback when the server cannot be reached: explore alone with example content. */
export function enterOffline(role: Role) {
  initAudio()
  const cfg = content.roles[role]
  resetPlayer()
  useStore.getState().setIdentity({ role, userId: 'offline', sessionId: tabSession, name: cfg.displayName, look: cfg.avatar, isOwner: false })
  useStore.setState({ phase: 'loading', worldReady: false, photos: placeholderPhotos, portal: null, conn: 'offline', remotes: [] })
  startAmbience()
}

export async function leaveWorld() {
  await room.stop()
  const backend = await getBackend().catch(() => null)
  await backend?.leave()
  useStore.setState({ phase: 'welcome', identity: null, worldReady: false, overlay: null, focus: null, remotes: [], conn: 'offline', superseded: false })
}

export async function reloadPhotos() {
  const backend = await getBackend()
  const photos = await backend.loadPhotos()
  useStore.setState({ photos })
}
