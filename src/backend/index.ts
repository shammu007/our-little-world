import { env } from '../lib/env'
import type { Backend } from './types'

let instance: Promise<Backend> | null = null

/** Picks Supabase when configured, otherwise the offline demo backend. Both are code-split. */
export function getBackend(): Promise<Backend> {
  if (!instance) {
    instance = env.hasSupabase
      ? import('./supabase').then((m) => new m.SupabaseBackend(env.supabaseUrl, env.supabaseAnonKey))
      : import('./local').then((m) => new m.LocalBackend())
  }
  return instance
}
