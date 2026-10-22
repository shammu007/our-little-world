import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build:standalone` makes ONE html file that works when double-clicked (no server needed).
export default defineConfig(({ mode }) => ({
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
