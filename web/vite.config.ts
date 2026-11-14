import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './', // relative paths, so the same build works on GitHub Pages under any repo name
  plugins: [react()],
})
