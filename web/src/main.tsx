import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are bundled, so the app really works offline and asks no other server for anything.
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import '@fontsource/fraunces/600.css'
import '@fontsource/fraunces/700.css'
import '@fontsource/patrick-hand/400.css'
import './index.css'
import App from './App.tsx'

// Keep a copy of the app on the phone, so that it opens with no connection (see public/sw.js).
// Not in the Android app, which carries its files inside, and not while developing.
if (import.meta.env.PROD && 'serviceWorker' in navigator && !('TintaNative' in window)) {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // no service worker here: the app works the same, it just needs a connection to open
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
