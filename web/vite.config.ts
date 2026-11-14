import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './', // relative paths, so the same build works on GitHub Pages under any repo name
  plugins: [react()],
  // The minute this copy was built (UTC). It goes into the line of timings a volunteer sends, so we know which version wrote it.
  define: { __BUILD__: JSON.stringify(new Date().toISOString().slice(0, 16) + 'Z') },
})
