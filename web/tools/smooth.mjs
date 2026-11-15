// Does a screen stay responsive? Opens the built app in a headless Chrome WITH its animations running,
// goes to "Ask Tinta", opens every answer, moves both sliders, and measures the gaps between painted frames
// and any task that blocks the page for more than 50 ms. A tester reported that this screen froze their tab.
//
//   npm run build && npx vite preview --port 4188      (in another terminal)
//   node tools/smooth.mjs [url]
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const url = process.argv[2] ?? 'http://localhost:4188/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const chrome = spawn(process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--remote-debugging-port=9397', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'tinta-smooth-'))}`,
  '--no-first-run', '--hide-scrollbars', '--window-size=390,844', 'about:blank',
])
let target
for (let i = 0; i < 40 && !target; i++) {
  await sleep(250)
  target = await fetch('http://localhost:9397/json').then((r) => r.json()).then((l) => l.find((t) => t.type === 'page')).catch(() => null)
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const waiting = new Map()
ws.onmessage = (m) => {
  const d = JSON.parse(m.data)
  waiting.get(d.id)?.(d.result)
}
const cdp = (method, params = {}) => new Promise((res) => (waiting.set(++id, res), ws.send(JSON.stringify({ id, method, params }))))
const js = async (expression) => (await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value

await cdp('Page.enable')
await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await cdp('Page.navigate', { url })
await sleep(2000)
await js(`localStorage.setItem('tinta-lang', 'en'); location.reload()`)
await sleep(2000)

const measure = `(async (what) => {
  const gaps = [], long = []
  new PerformanceObserver(l => { for (const e of l.getEntries()) long.push(Math.round(e.duration)) }).observe({ entryTypes: ['longtask'] })
  let last = performance.now(), go = true
  const loop = (t) => { gaps.push(t - last); last = t; if (go) requestAnimationFrame(loop) }
  requestAnimationFrame(loop)
  await what()
  await new Promise(r => setTimeout(r, 1500))
  go = false
  const g = gaps.slice(2).sort((a, b) => a - b)
  return { frames: g.length, median: Math.round(g[g.length >> 1]), p99: Math.round(g[Math.floor(g.length * .99)]), worst: Math.round(g[g.length - 1]), longTasks: long, animations: document.getAnimations().length, nodes: document.querySelectorAll('*').length }
})`
const press = `(label) => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === label)?.click()`

let bad = 0
const report = (name, r) => {
  const slow = r.worst > 120 || r.longTasks.some((d) => d > 200)
  if (slow) bad++
  console.log(`${slow ? 'SLOW' : 'ok  '} ${name}: ${r.frames} frames, median gap ${r.median} ms, 99% under ${r.p99} ms, worst ${r.worst} ms, long tasks ${JSON.stringify(r.longTasks)}, ${r.animations} animations, ${r.nodes} elements`)
}
report('first screen, 4 s', await js(`${measure}(() => new Promise(r => setTimeout(r, 2500)))`))
await js(`(${press})('Ask Tinta')`)
await sleep(800)
report('Ask Tinta, open every answer and move both sliders', await js(`${measure}(async () => {
  for (const f of document.querySelectorAll('summary')) { f.click(); await new Promise(r => setTimeout(r, 150)) }
  const set = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v)); el.dispatchEvent(new Event('input', { bubbles: true })) }
  const [a, b] = document.querySelectorAll('input[type=range]')
  for (let i = 0; i <= 12; i++) { set(a, i); await new Promise(r => setTimeout(r, 50)) }
  for (let i = 0; i <= 20; i++) { set(b, (i / 10).toFixed(1)); await new Promise(r => setTimeout(r, 50)) }
  for (const f of document.querySelectorAll('summary')) { f.click(); await new Promise(r => setTimeout(r, 60)) }
})`))
report('Ask Tinta, left alone for 6 s', await js(`${measure}(() => new Promise(r => setTimeout(r, 4500)))`))
console.log(bad ? `\n${bad} measurement(s) show the page stalling.` : '\nThe page stays responsive: no frame gap over 120 ms and no long blocking task.')
ws.close()
chrome.kill()
process.exit(bad ? 1 : 0)
