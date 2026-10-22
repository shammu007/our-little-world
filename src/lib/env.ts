const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || ''
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || ''

export const env = {
  supabaseUrl: url,
  supabaseAnonKey: anonKey,
  roomId: ((import.meta.env.VITE_ROOM_ID as string | undefined)?.trim() || 'our-little-world').replace(/[^a-z0-9-_]/gi, '-'),
  hasSupabase: Boolean(url && anonKey),
}
