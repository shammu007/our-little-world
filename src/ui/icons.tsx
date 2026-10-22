const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export const Icon = {
  close: () => (
    <svg viewBox="0 0 24 24" {...s} width="18" height="18" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  sound: () => (
    <svg viewBox="0 0 24 24" {...s} aria-hidden>
      <path d="M4 10v4h4l5 4V6L8 10H4z" />
      <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" />
    </svg>
  ),
  muted: () => (
    <svg viewBox="0 0 24 24" {...s} aria-hidden>
      <path d="M4 10v4h4l5 4V6L8 10H4z" />
      <path d="M17 9l5 6M22 9l-5 6" />
    </svg>
  ),
  gear: () => (
    <svg viewBox="0 0 24 24" {...s} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </svg>
  ),
  help: () => (
    <svg viewBox="0 0 24 24" {...s} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 015 .5c0 1.7-2.5 2-2.5 3.5M12 17h.01" />
    </svg>
  ),
  edit: () => (
    <svg viewBox="0 0 24 24" {...s} aria-hidden>
      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  ),
  left: () => (
    <svg viewBox="0 0 24 24" {...s} aria-hidden>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  ),
  right: () => (
    <svg viewBox="0 0 24 24" {...s} aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
}

/** Little face drawings for the welcome cards (original artwork). */
export function Face({ kind, skin, hair }: { kind: 'male' | 'female'; skin: string; hair: string }) {
  return (
    <svg className="role-face" viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="46" fill="#EEF1E8" />
      {kind === 'female' && <ellipse cx="50" cy="62" rx="30" ry="30" fill={hair} />}
      {kind === 'female' && <circle cx="50" cy="20" r="10" fill={hair} />}
      <circle cx="50" cy="54" r="26" fill={skin} />
      <path d={kind === 'female' ? 'M24 52 Q26 24 50 26 Q76 26 76 52 Q66 36 44 38 Q32 40 24 52Z' : 'M25 50 Q26 26 50 26 Q74 26 75 50 Q68 37 50 38 Q34 38 25 50Z'} fill={hair} />
      <circle cx="41" cy="56" r="3" fill="#2F2A28" />
      <circle cx="59" cy="56" r="3" fill="#2F2A28" />
      <circle cx="35" cy="63" r="4" fill="#EBA7A0" opacity="0.6" />
      <circle cx="65" cy="63" r="4" fill="#EBA7A0" opacity="0.6" />
      <path d="M45 65 Q50 69 55 65" stroke="#2F2A28" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function CakeMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden>
      <rect x="10" y="36" width="44" height="18" rx="5" fill="#F4E9DA" />
      <path d="M10 41 q5 5 9 0 q5 5 9 0 q5 5 9 0 q5 5 9 0 q4 5 8 0 V40 H10z" fill="#E7C3BE" />
      <rect x="18" y="24" width="28" height="13" rx="4" fill="#F7EFE4" />
      <rect x="30.5" y="12" width="3" height="12" rx="1.5" fill="#BFD0C0" />
      <ellipse className="flame" cx="32" cy="9" rx="2.6" ry="4" fill="#FFC46B" />
    </svg>
  )
}
