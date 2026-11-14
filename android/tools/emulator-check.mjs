// End-to-end check of the Android app on an emulator or phone, with real touch events.
//
// The finger is driven through `adb shell input motionevent` (the system's own touch pipeline),
// and the page is read through the WebView's DevTools socket. Needs a debug build running.
//
//   node android/tools/emulator-check.mjs [screenshot.png]
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const ADB = process.env.ADB ?? `${process.env.LOCALAPPDATA}/Android/Sdk/platform-tools/adb.exe`
const adb = (...args) => execFileSync(ADB, args, { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const pid = adb('shell', 'pidof', 'app.tinta').trim()
if (!pid) throw new Error('Tinta is not running on the device')
adb('forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`)
const [page] = await (await fetch('http://localhost:9222/json')).json()
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let nextId = 0
const pending = new Map()
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  pending.get(msg.id)?.(msg.result)
}
const cdp = (method, params = {}) =>
  new Promise((resolve) => {
    pending.set(++nextId, resolve)
    ws.send(JSON.stringify({ id: nextId, method, params }))
  })
const js = async (expression) =>
  (await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value

// Where the web page sits on the physical screen.
try {
  adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml')
} catch {
  // the dump is written even when the tool gives up waiting for the animated page to go idle
}
const xml = adb('exec-out', 'cat', '/sdcard/ui.xml')
const [, left, top] = xml.match(/class="android\.webkit\.WebView"[^>]*bounds="\[(\d+),(\d+)\]/).map(Number)
const dpr = await js('devicePixelRatio')
const toScreen = ([x, y]) => [Math.round(left + x * dpr), Math.round(top + y * dpr)]

const rectOf = (finder) =>
  js(`(() => { const e = ${finder}; if (!e) return null; e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height] })()`)
const button = (label) => `[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(label)}))`

async function tap(finder) {
  const r = await rectOf(finder)
  if (!r) throw new Error('not on screen: ' + finder)
  const [x, y] = toScreen([r[0] + r[2] / 2, r[1] + r[3] / 2])
  adb('shell', 'input', 'tap', String(x), String(y))
  await sleep(500)
}

/** One finger stroke through points given as fractions of the canvas. */
async function stroke(points) {
  const r = await rectOf(`document.querySelector('canvas')`)
  const at = ([fx, fy]) => toScreen([r[0] + fx * r[2], r[1] + fy * r[3]]).map(String)
  adb('shell', 'input', 'motionevent', 'DOWN', ...at(points[0]))
  for (const p of points.slice(1)) adb('shell', 'input', 'motionevent', 'MOVE', ...at(p))
  adb('shell', 'input', 'motionevent', 'UP', ...at(points.at(-1)))
}

const circle = Array.from({ length: 17 }, (_, i) => [0.5 + 0.2 * Math.cos((i / 4) * Math.PI), 0.5 + 0.2 * Math.sin((i / 4) * Math.PI)])
const digit = (x) => [[x, 0.4], [x + 0.04, 0.5], [x, 0.6]]
const PLANS = [
  [[[0.18, 0.5], [0.82, 0.5], [0.18, 0.5], [0.82, 0.5], [0.18, 0.5]]],
  [[[0.5, 0.18], [0.5, 0.82], [0.5, 0.18], [0.5, 0.82], [0.5, 0.18]]],
  [circle],
  [[[0.1, 0.55], [0.18, 0.35], [0.22, 0.55], [0.3, 0.5], [0.38, 0.35], [0.42, 0.55], [0.5, 0.5], [0.58, 0.35], [0.62, 0.55], [0.7, 0.5], [0.78, 0.35], [0.82, 0.55]]],
  [0.08, 0.17, 0.26, 0.35, 0.44, 0.53, 0.62, 0.71, 0.8, 0.89].map(digit),
]

await js(`location.reload()`)
await sleep(2500)
console.log('page:', await js('document.title'), '| native voice bridge:', await js('Boolean(window.TintaNative)'))
await tap(button('Start'))
await tap(button('Skip')) // the three-card guide
await tap(button('Begin'))
for (const [i, plan] of PLANS.entries()) {
  if (i === 4) await tap(button('▶')) // the dictated phone number, spoken by Android
  for (const s of plan) {
    await stroke(s)
    await sleep(300)
  }
  await tap(button('Done'))
  console.log(`task ${i + 1}:`, (await js(`document.querySelector('.stats').innerText`)).replace(/\n/g, ' '))
  await tap(i === 4 ? button('See the result') : button('Next'))
}
// If the short check is unsure, the app asks for a closer look: three more tasks.
if (await js(`Boolean(${button('Three more')})`)) {
  console.log('short check unsure -> closer look')
  await tap(button('Three more'))
  for (const plan of [[0.1, 0.25, 0.4, 0.55, 0.7, 0.85].map(digit), [0.2, 0.35, 0.5, 0.65, 0.8].map(digit), PLANS[4]]) {
    for (const s of plan) {
      await stroke(s)
      await sleep(300)
    }
    await tap(button('Done'))
    await tap((await js(`Boolean(${button('See the result')})`)) ? button('See the result') : button('Next'))
  }
}
console.log('\n' + (await js(`document.querySelector('main').innerText`)).split('\n').filter(Boolean).slice(0, 12).join('\n'))
await js('window.scrollTo(0, 0)')
await sleep(300)
if (process.argv[2]) {
  const shot = await cdp('Page.captureScreenshot', { format: 'png' })
  writeFileSync(process.argv[2], Buffer.from(shot.data, 'base64'))
  console.log('screenshot:', process.argv[2])
}
ws.close()
