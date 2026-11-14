// Takes a picture of every screen of the app, at phone size, for the write-up and the video.
// It opens a headless Chrome, walks through the check by "writing" on the sheet, and saves PNGs.
//
//   npm run dev                      (in another terminal)
//   node tools/screens.mjs <folder> [url]
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { perform } from './shapes.mjs'

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
  window.press = (label) => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim().includes(label) && !b.disabled); b?.click(); return Boolean(b) }
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
// A missing button stops the run: the walk through the app is also a test of its flow.
const press = async (label) => {
  if (!(await js(`press(${JSON.stringify(label)})`))) throw new Error(`no button "${label}" on this screen: ${await js('document.body.innerText.slice(0, 200)')}`)
  await sleep(500)
}
// One task, written the way shapes.mjs describes it (quicker than a person, to keep the run short).
const task = async (id, how = {}) => {
  for (const { pts, ms, gap } of perform(id, how)) {
    await js(`stroke(${JSON.stringify(pts)}, ${Math.round(ms)})`)
    await sleep(gap + 120)
  }
}
const says = () => js(`document.querySelector('.cheer')?.textContent ?? ''`)

await shot('home')
await press('Start')
await shot('guide')
await press('Skip')
await shot('ready')
await press('Begin')
await shot('practice')
// Practice done badly first: Tinta says what she saw and offers another go.
await task(2, { lifts: 5, seconds: 1.6, pause: 0.15 })
await press("I'm done")
await shot('practice-not-as-asked')
console.log('practice, lifting 5 times ->', await says())
await press('Try again')
await task(2, { seconds: 1.6 })
await press("I'm done")
await press('Next')
await task(3, { seconds: 1.4 })
await press("I'm done")
await press('Next')
// One lap of the circle instead of four.
await task(5, { amount: 0.25, seconds: 0.8 })
await press("I'm done")
await shot('circle-not-as-asked')
console.log('one lap of the circle ->', await says())
await press('Try again')
await task(5, { seconds: 3 })
await shot('circle')
await press("I'm done")
await press('Next')
await task(9, { lifts: 3, seconds: 3, pause: 0.7 })
await shot('loops')
await press("I'm done")
await sleep(1200)
await shot('invisible-ink')
await press('Next')
await task(16, { seconds: 2 })
await press("I'm done")
await press('See the result')
await shot('closer-look')
await press('Three more')
for (const id of [6, 22, 23]) {
  await task(id, { seconds: 2 })
  await press("I'm done")
  await press(id === 23 ? 'See the result' : 'Next')
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
// A second, quick run where the circle is left at one lap: there must be no score at the end.
await press('Start')
await press('Skip')
await press('Begin')
for (const id of [2, 3]) {
  await task(id, { seconds: 1.2 })
  await press("I'm done")
  await press('Next')
}
await task(5, { amount: 0.25, seconds: 0.8 })
await press("I'm done")
await press('Keep it')
await task(9, { seconds: 2 })
await press("I'm done")
await press('Next')
// The word in a single drag: on a phone that leaves no pause to time, and Tinta asks for it letter by letter.
await task(16, { lifts: 0, seconds: 2 })
await press("I'm done")
await shot('word-no-pause')
console.log('word in a single drag ->', await says())
await press('Try again')
await task(16, { seconds: 2 })
await press("I'm done")
await press('See the result')
await shot('no-result')
console.log('circle left at one lap ->', await js(`document.querySelector('h1').textContent + ' | ' + document.querySelector('.issues').textContent + ' | number shown: ' + Boolean(document.querySelector('.meter'))`))
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
