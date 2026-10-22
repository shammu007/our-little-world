import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build:standalone` makes ONE html file that works when double-clicked (no server needed).
/**
 * Supabase settings may come in as VITE_* (our docs) or under the names Vercel's Supabase
 * integration creates. Only the public URL and the public anon/publishable key are read here,
 * never a service-role or secret key.
 */
function publicSupabaseEnv(mode: string) {
  const e = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const pick = (...keys: string[]) => keys.map((k) => e[k]?.trim()).find(Boolean) ?? ''
  return {
    url: pick('VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'),
    key: pick('VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_PUBLISHABLE_KEY'),
  }
}

export default defineConfig(({ mode }) => ({
  define:
    mode === 'standalone'
      ? {}
      : {
          'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(publicSupabaseEnv(mode).url),
          'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(publicSupabaseEnv(mode).key),
        },
  plugins: mode === 'standalone' ? [react(), viteSingleFile()] : [react()],
  base: mode === 'standalone' ? './' : '/',
  build: {
    outDir: mode === 'standalone' ? 'standalone' : 'dist',
    assetsInlineLimit: mode === 'standalone' ? 100_000_000 : 4096,
    target: 'es2020',
    // the physics engine ships its WebAssembly inline, so the 3D chunk is large but loaded lazily
    chunkSizeWarningLimit: 2600,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
}) as never)
