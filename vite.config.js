import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base relativo: funziona sia su GitHub Pages (repo/sottocartella) sia in locale.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
})
