// Drive the real app from a list of steps, and print what is on the screen after each one.
// For exploring: a person, or a language model playing a kind of user, decides the steps and reads the answers.
// (screens.mjs is the fixed walk that runs the same way every time; this is the free one.)
//
//   node tools/drive.mjs <<'JSON'
//   { "lang": "en", "size": "390x844", "params": "",
//     "steps": [ {"press": "Start"}, {"press": "Skip"}, {"press": "Begin"},
//                {"task": 2}, {"press": "done"}, {"shot": "after-practice"} ] }
//   JSON
//
// Steps:
//   {"press": "text"}             press the button, link or fold whose text is, or contains, that text (any case)
//   {"task": 5, "how": {...}}     write on the sheet the shape of that task; "how" as in  npx vite-node tools/try.ts --help
//                                 (amount, lifts, pause, seconds, do: scribble | taps | dash, where, shaky)
//   {"slide": [0, 6]}             set slider number 0 (the first on the screen) to 6
//   {"type": ["css selector", "text"]}
//   {"scroll": "bottom"}          or "top", or a css selector to bring into view
//   {"shot": "name"}              save a picture of the screen and print where it is
//   {"wait": 800}                 milliseconds
//   {"reload": true}              reload the page, as a user might by accident
// Options: "lang" en | es, "size" WIDTHxHEIGHT in CSS pixels, "params" added to the address ("?closer", "?friends", "?study"),
//          "dialogs" ok | cancel: what to answer when the app asks a yes/no question (default ok).
// The app must be running: by default at http://localhost:4199/ (set TINTA_URL for another address).
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { perform } from './shapes.mjs'

const raw = process.argv[2] && process.argv[2] !== '-' ? process.argv[2] : readFileSync(0, 'utf8')
if (!raw.trim() || raw.trim() === '--help') {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'))
  process.exit(0)
}
let plan
try {
  plan = JSON.parse(raw)
} catch (e) {
  console.error('That is not valid JSON:', e.message)
  process.exit(2)
}
const steps = plan.steps ?? []
const lang = plan.lang === 'es' ? 'es' : 'en'
const [W, H] = (plan.size ?? '390x844').split('x').map(Number)
const base = process.env.TINTA_URL ?? 'http://localhost:4199/'
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9400 + Math.floor(Math.random() * 500) // several of these can run at the same time
const shots = join(tmpdir(), 'tinta-drive')
mkdirSync(shots, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'tinta-drive-'))}`,
  '--no-first-run', '--hide-scrollbars', '--force-prefers-reduced-motion', 'about:blank',
])
const stop = (code) => {
  chrome.kill()
  process.exit(code)
}
let target
for (let i = 0; i < 60 && !target; i++) {
  await sleep(250)
  target = await fetch(`http://localhost:${PORT}/json`).then((r) => r.json()).then((l) => l.find((p) => p.type === 'page')).catch(() => null)
}
if (!target) {
  console.error('Chrome did not start.')
  stop(2)
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const waiting = new Map()
const errors = []
ws.onmessage = (m) => {
  const d = JSON.parse(m.data)
  if (d.method === 'Page.javascriptDialogOpening') {
    console.log(`   the app asks: "${d.params.message}" -> ${plan.dialogs === 'cancel' ? 'Cancel' : 'OK'}`)
    ws.send(JSON.stringify({ id: ++id, method: 'Page.handleJavaScriptDialog', params: { accept: plan.dialogs !== 'cancel' } }))
  }
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text)
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error' && !d.params.entry.text.includes('navigator.vibrate')) errors.push(d.params.entry.text)
  waiting.get(d.id)?.(d.result)
}
const cdp = (method, params = {}) => new Promise((res) => (waiting.set(++id, res), ws.send(JSON.stringify({ id, method, params }))))
const js = async (expression) => (await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value

const helpers = `
  window.press = (label) => {
    const want = label.trim().toLowerCase()
    const all = [...document.querySelectorAll('button, summary, a')].filter(b => !b.disabled && b.offsetParent !== null)
    const b = all.find(b => b.textContent.trim().toLowerCase() === want) ?? all.find(b => b.textContent.trim().toLowerCase().includes(want))
    b?.click()
    return Boolean(b)
  }
  window.stroke = async (pts, ms) => {
    const c = document.querySelector('canvas'), r = c.getBoundingClientRect()
    const ev = (type, p) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, isPrimary: true, pointerType: 'touch', clientX: r.left + p[0] * r.width, clientY: r.top + p[1] * r.height }))
    ev('pointerdown', pts[0])
    for (const p of pts.slice(1)) { await new Promise(r => setTimeout(r, ms / pts.length)); ev('pointermove', p) }
    ev('pointerup', pts[pts.length - 1])
  }
  window.setValue = (el, value) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, String(value))
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
  }
  window.screenNow = () => {
    const words = (document.querySelector('main')?.innerText ?? document.body.innerText).replace(/\\s*\\n\\s*/g, ' | ').replace(/\\s+/g, ' ').trim()
    const buttons = [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null).map(b => '[' + b.textContent.trim() + (b.disabled ? ' (off)' : '') + ']')
    const folds = [...document.querySelectorAll('summary')].filter(b => b.offsetParent !== null).map(b => '<' + b.textContent.trim() + '>')
    const sliders = [...document.querySelectorAll('input[type=range]')].map((s, i) => 'slider ' + i + ' = ' + s.value)
    const below = [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null && b.getBoundingClientRect().top > innerHeight).length
    const wide = document.documentElement.scrollWidth > innerWidth + 1
    return { words, buttons, folds, sliders, sheet: Boolean(document.querySelector('canvas')), below, wide, tall: document.documentElement.scrollHeight, focus: document.activeElement?.tagName + (document.activeElement?.className ? '.' + String(document.activeElement.className).split(' ')[0] : '') }
  }`

await cdp('Runtime.enable')
await cdp('Log.enable')
await cdp('Page.enable')
await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: true })
await cdp('Page.navigate', { url: base + (plan.params ?? '') })
await sleep(2000)
await js(`localStorage.setItem('tinta-lang', '${lang}'); location.reload()`)
await sleep(2200)
await js(helpers)

const show = async () => {
  const s = await js('screenNow()')
  if (!s) return console.log('   (nothing to read: the page did not answer)')
  console.log(`   SCREEN: ${s.words.slice(0, 900)}${s.words.length > 900 ? ' …' : ''}`)
  console.log(`   BUTTONS: ${s.buttons.join(' ') || '(none)'}${s.folds.length ? '   FOLDS: ' + s.folds.join(' ') : ''}${s.sliders.length ? '   ' + s.sliders.join(', ') : ''}`)
  console.log(`   ${s.sheet ? 'a sheet to write on · ' : ''}page ${s.tall} px tall on a ${H} px screen${s.below ? ` · ${s.below} button(s) below the first screenful` : ''}${s.wide ? ' · STICKS OUT SIDEWAYS' : ''} · focus on ${s.focus}`)
}

console.log(`Tinta at ${W}x${H}, language ${lang}${plan.params ? ', ' + plan.params : ''}`)
await show()
let n = 0
for (const step of steps) {
  n++
  console.log(`\n${n}. ${JSON.stringify(step)}`)
  if (step.press !== undefined) {
    if (!(await js(`press(${JSON.stringify(String(step.press))})`))) {
      console.log(`   THERE IS NO BUTTON "${step.press}" HERE. The run stops.`)
      await show()
      stop(1)
    }
    await sleep(650)
  } else if (step.task !== undefined) {
    if (!(await js(`Boolean(document.querySelector('canvas'))`))) {
      console.log('   THERE IS NO SHEET TO WRITE ON HERE. The run stops.')
      await show()
      stop(1)
    }
    let plan_
    try {
      plan_ = perform(Number(step.task), step.how ?? {})
    } catch (e) {
      console.log('   ' + e.message)
      stop(2)
    }
    for (const { pts, ms, gap } of plan_) {
      await js(`stroke(${JSON.stringify(pts)}, ${Math.round(ms)})`)
      await sleep(gap + 100)
    }
    await sleep(250)
  } else if (step.slide !== undefined) {
    await js(`setValue(document.querySelectorAll('input[type=range]')[${Number(step.slide[0])}], ${Number(step.slide[1])})`)
    await sleep(300)
  } else if (step.type !== undefined) {
    const ok = await js(`(() => { const el = document.querySelector(${JSON.stringify(step.type[0])}); if (!el) return false; setValue(el, ${JSON.stringify(step.type[1])}); return true })()`)
    if (!ok) console.log(`   nothing matches ${step.type[0]}`)
    await sleep(300)
  } else if (step.scroll !== undefined) {
    await js(step.scroll === 'bottom' ? 'window.scrollTo(0, document.documentElement.scrollHeight)' : step.scroll === 'top' ? 'window.scrollTo(0, 0)' : `document.querySelector(${JSON.stringify(step.scroll)})?.scrollIntoView({ block: 'center' })`)
    await sleep(400)
  } else if (step.shot !== undefined) {
    await sleep(500)
    const file = join(shots, `${Date.now()}-${String(step.shot).replace(/[^a-z0-9-]/gi, '_')}.png`)
    writeFileSync(file, Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))
    console.log(`   picture saved: ${file}`)
    continue
  } else if (step.wait !== undefined) {
    await sleep(Math.min(8000, Number(step.wait)))
    continue
  } else if (step.reload) {
    await js('location.reload()')
    await sleep(2200)
    await js(helpers)
  } else {
    console.log('   I do not know this step. Use press, task, slide, type, scroll, shot, wait or reload.')
    stop(2)
  }
  await show()
}
if (errors.length) console.log('\nERRORS IN THE PAGE:\n  ' + errors.map((e) => String(e).slice(0, 200)).join('\n  '))
else console.log('\nNo error in the page.')
ws.close()
stop(0)
