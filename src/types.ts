export type Role = 'me' | 'sweetheart'
export type AvatarKind = 'male' | 'female'
export type Wall = 'left' | 'back' | 'right'

export interface Photo {
  id: string
  /** Resolved, displayable URL (signed URL, object URL or bundled asset). */
  src: string
  caption: string
  wall: Wall
  order: number
  /** width / height of the original image. */
  aspect: number
  /** Path in private storage (Supabase) or IndexedDB key (demo). */
  storagePath?: string
  placeholder?: boolean
}

export interface EntranceQuestion {
  id: string
  prompt: string
  /** Empty list means any non-empty answer is accepted. Matching ignores case, accents and punctuation. */
  acceptedAnswers: string[]
  hint?: string
  placeholder?: string
}

export interface AvatarLook {
  kind: AvatarKind
  skin: string
  hair: string
  top: string
  bottom: string
  shoes: string
}

export interface RoleConfig {
  label: string
  displayName: string
  avatar: AvatarLook
  questions: EntranceQuestion[]
}

export interface WorldContent {
  title: string
  welcomeLine: string
  whoPrompt: string
  signText: string
  roles: Record<Role, RoleConfig>
  /** Demo-mode only: a shared access code checked in the browser. In Supabase mode the code lives (hashed) on the server. */
  demoAccessCode?: string
  enterButton: string
}

export interface Letter {
  title: string
  greeting: string
  paragraphs: string[]
  signature: string
}

export interface PortalPublic {
  clue: string
  hint: string
}

export interface PortalSecret extends PortalPublic {
  acceptedAnswers: string[]
  letter: Letter
}

export type AnimState = 'idle' | 'walk' | 'run' | 'jump'
