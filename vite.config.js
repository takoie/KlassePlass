import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './', // for electron relative paths
  build: {
    outDir: 'dist-react',
  },
  server: {
    port: 3000,
  },
})
