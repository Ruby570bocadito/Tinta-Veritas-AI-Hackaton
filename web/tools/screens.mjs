// Takes a picture of every screen of the app, at phone size, for the write-up and the video.
// It opens a headless Chrome, walks through the check by "writing" on the sheet, and saves PNGs.
//
//   npm run dev                      (in another terminal)
//   node tools/screens.mjs <folder> [url]
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const out = process.argv[2] ?? 'screens'
const url = process.argv[3] ?? 'http://localhost:5173/?closer'
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9377
mkdirSync(out, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'tinta-'))}`,
  '--no-first-run', '--hide-scrollbars', '--force-prefers-reduced-motion', 'about:blank',
])
let target
for (let i = 0; i < 40 && !target; i++) {
  await sleep(250)
  target = await fetch(`http://localhost:${PORT}/json`).then((r) => r.json()).then((l) => l.find((t) => t.type === 'page')).catch(() => null)
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

// SIZE=360x640 tries a smaller phone. Each screen also reports anything that sticks out of it.
const [W, H] = (process.env.SIZE ?? '390x844').split('x').map(Number)
await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true })
await cdp('Page.navigate', { url })
await sleep(2500)
await js(`localStorage.setItem('tinta-lang', 'en'); localStorage.removeItem('tinta-history'); location.reload()`)
await sleep(2500)

// Helpers that live in the page: press a button by its text, and write a stroke on the sheet.
await js(`
  window.press = (label) => [...document.querySelectorAll('button')].find(b => b.textContent.trim().includes(label)).click()
  window.stroke = async (pts, ms) => {
    const c = document.querySelector('canvas'), r = c.getBoundingClientRect()
    const ev = (type, p) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: 'touch', clientX: r.left + p[0] * r.width, clientY: r.top + p[1] * r.height }))
    ev('pointerdown', pts[0])
    for (const p of pts.slice(1)) { await new Promise(r => setTimeout(r, ms / pts.length)); ev('pointermove', p) }
    ev('pointerup', pts[pts.length - 1])
  }`)

let n = 0
async function shot(name) {
  await js('window.scrollTo(0, 0)')
  await sleep(900)
  const png = await cdp('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(out, `${String(++n).padStart(2, '0')}-${name}.png`), Buffer.from(png.data, 'base64'))
  const sticking = await js(`(() => {
    const wide = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) })
      .map(e => e.tagName + '.' + e.className).slice(0, 4)
    const b = [...document.querySelectorAll('button')].filter(e => { const r = e.getBoundingClientRect(); return r.height > 0 && r.bottom > innerHeight + 1 }).map(e => e.textContent.trim().slice(0, 20))
    return JSON.stringify({ page: document.documentElement.scrollHeight, wide, buttonsBelow: b })
  })()`)
  console.log("saved", name, sticking)
}
const press = async (label) => (await js(`press(${JSON.stringify(label)})`), await sleep(500))
const write = async (strokes, ms = 700, pause = 500) => {
  for (const s of strokes) {
    await js(`stroke(${JSON.stringify(s)}, ${ms})`)
    await sleep(pause)
  }
}

const loops = [[0.1, 0.55], [0.16, 0.4], [0.2, 0.3], [0.17, 0.5], [0.22, 0.56], [0.3, 0.5], [0.36, 0.4], [0.4, 0.3], [0.37, 0.5], [0.42, 0.56], [0.5, 0.5], [0.56, 0.4], [0.6, 0.3], [0.57, 0.5], [0.62, 0.56], [0.7, 0.5], [0.76, 0.4], [0.8, 0.3], [0.77, 0.5], [0.82, 0.56]]
const circle = Array.from({ length: 33 }, (_, i) => [0.5 + 0.17 * Math.cos((i / 8) * Math.PI), 0.5 + 0.2 * Math.sin((i / 8) * Math.PI)])
const letters = (xs) => xs.map((x) => [[x, 0.38], [x + 0.03, 0.5], [x - 0.02, 0.6], [x + 0.04, 0.62]])

await shot('home')
await press('Start')
await shot('guide')
await press('Skip')
await shot('ready')
await press('Begin')
await shot('practice')
await write([[[0.18, 0.5], [0.82, 0.5], [0.18, 0.5], [0.82, 0.5]]])
await press("I'm done")
await press('Next')
await write([[[0.5, 0.18], [0.5, 0.82], [0.5, 0.18], [0.5, 0.82]]])
await press("I'm done")
await press('Next')
await write([circle], 1500)
await shot('circle')
await press("I'm done")
await press('Next')
await write([loops.slice(0, 10), loops.slice(10)], 900, 900)
await shot('loops')
await press("I'm done")
await sleep(1200)
await shot('invisible-ink')
await press('Next')
await write(letters([0.2, 0.33, 0.46, 0.59, 0.72]), 350, 600)
await press("I'm done")
await press('See the result')
await shot('closer-look')
await press('Three more')
for (const xs of [[0.25, 0.5, 0.75], [0.12, 0.22, 0.32, 0.46, 0.56, 0.66, 0.8, 0.9], [0.12, 0.22, 0.32, 0.46, 0.56, 0.66, 0.8, 0.9]]) {
  await write(letters(xs), 300, 450)
  await press("I'm done")
  await js(`press(document.body.innerText.includes('See the result') ? 'See the result' : 'Next')`)
  await sleep(500)
}
await shot('result')
await js(`document.querySelector('.history')?.scrollIntoView({ block: 'center' })`)
await sleep(500)
const png = await cdp('Page.captureScreenshot', { format: 'png' })
writeFileSync(join(out, `${String(++n).padStart(2, '0')}-history.png`), Buffer.from(png.data, 'base64'))
if (url.includes('friends')) {
  // Invited testers: fill in the form and press Send; the share sheet is replaced by a recorder.
  await js(`window.shared = null; navigator.share = async (d) => { window.shared = d.text }`)
  await js(`(() => { const set = (el, v) => { Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) }
    set(document.querySelector('input[type=text]'), 'Test person'); set(document.querySelector('textarea.words'), 'Easy to follow.') })()`)
  await sleep(300)
  await press('Send it')
  console.log('friends: message that would be shared: ' + (await js('window.shared'))?.slice(0, 260))
  await js(`document.querySelector('input[type=text]').scrollIntoView({ block: 'center' })`)
  await sleep(400)
  writeFileSync(join(out, 'friends.png'), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
}
if (url.includes('study')) {
  // Study mode: saving the volunteer keeps one line of timings on the phone.
  await press('Save this person')
  console.log('study: people saved on this phone =', await js(`JSON.parse(localStorage.getItem('tinta-study')).length`), '| copy-all button:', await js(`[...document.querySelectorAll('button')].some(b => b.textContent.includes('Copy all 1'))`))
  await js(`localStorage.removeItem('tinta-study')`)
}
await press('Start again')
await press('See real cases')
await press('Show a mistake')
await shot('real-case-mistake')
await press('Back to the start')
await press('Ask Tinta')
await js(`document.querySelectorAll('details')[3].open = true`)
await shot('ask-tinta')

ws.close()
chrome.kill()
