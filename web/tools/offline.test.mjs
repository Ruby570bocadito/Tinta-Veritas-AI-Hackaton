// Does the web app really work with no connection, after one visit?
// Serves the built app, opens it once in a headless Chrome, STOPS THE SERVER, and opens it again.
//
//   npm run build && node tools/offline.test.mjs
import { execSync, spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SITE = 4203
const PORT = 9391
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stopServer = () => {
  try {
    execSync(`powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${SITE} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"`, { stdio: 'ignore' })
  } catch {
    // nothing was listening
  }
}

stopServer()
const server = spawn('npx', ['vite', 'preview', '--port', String(SITE), '--strictPort'], { shell: true, stdio: 'ignore' })
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'tinta-off-'))}`, '--no-first-run', 'about:blank'])
const finish = (code) => {
  chrome.kill()
  server.kill()
  stopServer()
  process.exit(code)
}

let target
for (let i = 0; i < 60 && !target; i++) {
  await sleep(250)
  target = await fetch(`http://localhost:${PORT}/json`).then((r) => r.json()).then((l) => l.find((p) => p.type === 'page')).catch(() => null)
}
if (!target) {
  console.log('The test browser did not start (is the computer very busy?). Nothing was tested.')
  finish(2)
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const waiting = new Map()
const pageErrors = []
ws.onmessage = (m) => {
  const d = JSON.parse(m.data)
  if (d.method === 'Runtime.exceptionThrown') pageErrors.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text)
  if (d.method === 'Log.entryAdded') pageErrors.push(d.params.entry.level + ': ' + d.params.entry.text + ' ' + (d.params.entry.url ?? ''))
  waiting.get(d.id)?.(d.result)
}
const cdp = (method, params = {}) => new Promise((res) => (waiting.set(++id, res), ws.send(JSON.stringify({ id, method, params }))))
const js = (expression) => Promise.race([cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }).then((r) => r.result?.value), sleep(20000).then(() => undefined)])

for (let i = 0; i < 40; i++) {
  if (await fetch(`http://localhost:${SITE}/`).then((r) => r.ok).catch(() => false)) break
  await sleep(250)
}
await cdp('Page.enable')
await cdp('Runtime.enable')
await cdp('Log.enable')
await cdp('Page.navigate', { url: `http://localhost:${SITE}/?friends` })
await sleep(2500)
const kept = await js(`navigator.serviceWorker.ready.then(() => new Promise(r => setTimeout(r, 2500))).then(() => caches.open('tinta-kept')).then(c => c.keys()).then(k => k.length)`)
console.log(`first visit, with the server running: ${kept} files kept on the "phone"`)

if (process.env.DEBUG) console.log('controlled by the worker:', await js('Boolean(navigator.serviceWorker.controller)'), '| some kept files:', await js(`caches.open('tinta-kept').then(c => c.keys()).then(k => k.slice(0, 4).map(r => r.url).join(' '))`))
stopServer() // from here on there is no server at all
await sleep(800)
const gone = await fetch(`http://localhost:${SITE}/`).then(() => false).catch(() => true)
const before = Date.now()
await js('location.reload()')
let title = ''
for (let i = 0; i < 40 && !title; i++) {
  await sleep(250)
  title = (await js(`document.querySelector('main h1')?.textContent ?? ''`)) ?? ''
}
console.log(`with no server, the first screen was there after ${((Date.now() - before) / 1000).toFixed(1)} s`)
if (process.env.DEBUG) {
  console.log('after the reload:', await js('location.href'), '|', await js('document.title'), '| root:', await js(`document.getElementById('root')?.innerHTML.length`))
  console.log('html:', await js('document.documentElement.outerHTML.slice(0, 700)'))
  console.log('resources:', await js(`performance.getEntriesByType('resource').map(r => r.name.split('/').pop() + ' ' + Math.round(r.duration) + 'ms').join(' | ')`))
  console.log('errors:', JSON.stringify(pageErrors))
}
// A picture and a font that the first screen never asked for: they must come from the kept copy.
const later = await js(`Promise.all(['./img/tinta-jump.webp', './img/tinta-shrug.webp', './img/tinta-caring.webp'].map(u => fetch(u).then(r => r.ok).catch(() => false))).then(a => a.every(Boolean))`)
// The big button of the first screen, whatever language the browser is in.
const pressed = await js(`(() => { const b = document.querySelector('main button.primary'); b?.click(); return Boolean(b) })()`)
await sleep(700)
const next = await js(`document.querySelector('main h1')?.textContent ?? ''`)
if (process.env.DEBUG) console.log('pressed:', pressed, '| first screen:', JSON.stringify(title), '| next screen:', JSON.stringify(next), '| buttons:', await js(`[...document.querySelectorAll('button')].map(b => b.textContent.trim()).join(' / ')`))

const checks = [
  ['the server is really stopped', gone],
  ['the app kept its files on the first visit', kept > 20],
  ['with no server, the app still opens', title.length > 0],
  ['pictures of screens not visited yet are there', later === true],
  ['and the app goes on to the next screen', pressed && next.length > 0 && next !== title],
]
for (const [what, ok] of checks) console.log(`${ok ? 'ok ' : 'NOT OK'}  ${what}`)
console.log(checks.every(([, ok]) => ok) ? '\nThe web app works with no connection after one visit.' : '\nThe web app does NOT work offline.')
ws.close()
finish(checks.every(([, ok]) => ok) ? 0 : 1)
