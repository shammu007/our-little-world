import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    // the physics engine ships its WebAssembly inline, so the 3D chunk is large but loaded lazily
    chunkSizeWarningLimit: 2600,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
} as never)
