// Makes "works offline" true for the web version: after the first visit the whole app is kept on the phone.
// It keeps the app's own files and nothing else: no writing, no result, nothing about the person.
//
// The page itself: the newest one if the network answers within a moment, otherwise the kept one.
// Everything else (code, fonts, pictures): the kept copy at once, and a fresh copy fetched for next time.
// The code's file names change whenever their content does, so a kept copy is never an old version of the same file.
const KEPT = 'tinta-kept'
const WAIT = 2500 // milliseconds to wait for the network before opening the kept page

self.addEventListener('install', (event) => {
  self.skipWaiting()
  // precache.json is written when the app is built (tools/precache.mjs): the list of every file of the app,
  // so the pictures of screens the person has not reached yet are kept too.
  event.waitUntil(
    fetch('./precache.json', { cache: 'no-store' })
      .then((response) => response.json())
      .then((files) => caches.open(KEPT).then((cache) => cache.addAll(files)))
      .catch(() => {}), // no list: the app still works, and files are kept as they are used
  )
})

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

const keep = (request, response) => {
  if (response.ok) {
    const copy = response.clone()
    caches.open(KEPT).then((cache) => cache.put(request, copy))
  }
  return response
}
// The address may carry ?friends or ?study, which do not change the file. Nor do the request's headers:
// these are plain files, the same for everyone, so a kept copy is right whatever the server says it varies by.
const kept = (request) => caches.match(request, { ignoreSearch: true, ignoreVary: true })

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    const fromNetwork = fetch(request).then((response) => keep(request, response))
    const tooSlow = new Promise((_, reject) => setTimeout(reject, WAIT))
    event.respondWith(
      Promise.race([fromNetwork, tooSlow]).catch(() =>
        kept(request)
          .then((page) => page ?? caches.match('./index.html'))
          .then((page) => page ?? fromNetwork),
      ),
    )
    return
  }
  event.respondWith(
    kept(request).then((copy) => {
      const fresh = fetch(request).then((response) => keep(request, response))
      if (!copy) return fresh
      fresh.catch(() => {}) // no connection: the kept copy is all there is, and that is fine
      return copy
    }),
  )
})
