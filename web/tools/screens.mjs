// Walks through the real app like a person would, at phone size, in English or Spanish.
// It is a test of the whole flow (a missing button stops the run) and it saves a picture of every screen.
// A headless Chrome "writes" on the sheet with touch events, using the shapes of shapes.mjs.
//
//   npm run dev                                   (in another terminal)
//   npx vite-node tools/screens.mjs <folder> [url]
//   SIZE=360x640 TINTA_LANG=es npx vite-node tools/screens.mjs <folder> [url]
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { STRINGS } from '../src/lib/strings'
import { perform } from './shapes.mjs'

const out = process.argv[2] ?? 'screens'
const url = process.argv[3] ?? 'http://localhost:5173/?closer'
const lang = process.env.TINTA_LANG === 'es' ? 'es' : 'en'
const t = STRINGS[lang]
const [W, H] = (process.env.SIZE ?? '390x844').split('x').map(Number)
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
  target = await fetch(`http://localhost:${PORT}/json`).then((r) => r.json()).then((l) => l.find((p) => p.type === 'page')).catch(() => null)
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const waiting = new Map()
const errors = []
ws.onmessage = (m) => {
  const d = JSON.parse(m.data)
  if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text)
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') errors.push(d.params.entry.text)
  // "Leave the page?" when reloading in the middle of the check: this walk reloads on purpose.
  if (d.method === 'Page.javascriptDialogOpening') cdp('Page.handleJavaScriptDialog', { accept: true })
  waiting.get(d.id)?.(d.result)
}
const cdp = (method, params = {}) => new Promise((res) => (waiting.set(++id, res), ws.send(JSON.stringify({ id, method, params }))))
const js = async (expression) => (await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value

await cdp('Runtime.enable')
await cdp('Log.enable')
await cdp('Page.enable')
// A phone has a finger and no mouse. Without this, a headless Chrome at phone size still says "I have a mouse",
// and the styles meant for a computer (the card with the QR code) would show in the phone pictures.
const phone = W < 900
await cdp('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: phone })
if (phone) await cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
await cdp('Page.navigate', { url })
await sleep(2500)
await js(`localStorage.setItem('tinta-lang', '${lang}'); localStorage.removeItem('tinta-history'); localStorage.removeItem('tinta-study'); location.reload()`)
await sleep(2500)

// Helpers that live in the page: press a button by its text, write a stroke on the sheet, move a slider.
// They are put back after every reload.
const HELPERS = `
  window.press = (label) => {
    const all = [...document.querySelectorAll('button')].filter(b => !b.disabled)
    const b = all.find(b => b.textContent.trim() === label) ?? all.find(b => b.textContent.trim().includes(label))
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
  window.slide = (index, value) => {
    const el = document.querySelectorAll('input[type=range]')[index]
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(value))
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  window.type = (selector, value) => {
    const el = document.querySelector(selector)
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }`
await js(HELPERS)
const reload = async () => {
  await js('location.reload()')
  await sleep(2200)
  await js(HELPERS)
}

let n = 0
const problems = []
async function shot(name) {
  await js('window.scrollTo(0, 0)')
  await sleep(900)
  const png = await cdp('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(out, `${String(++n).padStart(2, '0')}-${name}.png`), Buffer.from(png.data, 'base64'))
  // Anything that sticks out sideways is a layout bug on a phone.
  const wide = await js(`[...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) }).map(e => e.tagName + '.' + e.className).slice(0, 3).join(' ')`)
  if (wide) problems.push(`${name}: sticks out sideways: ${wide}`)
  console.log(`saved ${name} (page ${await js('document.documentElement.scrollHeight')} px tall)`)
}
// A missing button stops the run: the walk through the app is also a test of its flow.
const press = async (label) => {
  if (!(await js(`press(${JSON.stringify(label)})`))) throw new Error(`no button "${label}" on this screen: ${await js('document.body.innerText.slice(0, 200)')}`)
  await sleep(500)
}
const has = (label) => js(`[...document.querySelectorAll('button')].some(b => b.textContent.trim().includes(${JSON.stringify(label)}))`)
// One task, written the way shapes.mjs describes it (quicker than a person, to keep the run short).
const task = async (taskId, how = {}) => {
  for (const { pts, ms, gap } of perform(taskId, how)) {
    await js(`stroke(${JSON.stringify(pts)}, ${Math.round(ms)})`)
    await sleep(gap + 120)
  }
}
const says = () => js(`document.querySelector('.cheer')?.textContent ?? ''`)
const text = (selector) => js(`document.querySelector(${JSON.stringify(selector)})?.innerText ?? ''`)
const expect = (what, ok) => {
  console.log(`${ok ? 'ok ' : 'NOT OK'}  ${what}`)
  if (!ok) problems.push(what)
}

await shot('home')
// The card that sends someone from a computer to their phone: only for a mouse, and never cut by the window.
const card = await js(`(() => {
  const e = document.querySelector('.handoff')
  if (!e) return 'missing'
  if (getComputedStyle(e).display === 'none') return 'hidden'
  const r = e.getBoundingClientRect()
  return r.width > 0 && r.left >= 0 && r.right <= innerWidth && e.querySelector('img').naturalWidth > 0 ? 'shown' : 'cut'
})()`)
expect(phone ? 'at phone size, with a finger: no card about computers' : 'with a mouse: the card with the QR code is there, whole, with its picture', card === (phone ? 'hidden' : 'shown'))

// ---- the free sheet: write anything, the three numbers move, the invisible ink shows
await press(t.play.open)
await shot('free-sheet')
await task(9, { lifts: 3, seconds: 2.4, pause: 0.5 })
expect('free sheet: four strokes are counted as four touches while writing', (await text('.stats')).replace(/\s+/g, ' ').includes(`${t.task.touches} 4`))
await press(t.play.show)
await shot('free-sheet-ink')
await press(t.play.again)
expect('free sheet: "write again" gives an empty sheet', !(await has(t.play.again)) && (await text('.stats')).replace(/\s+/g, ' ').includes(`${t.task.touches} 0`))
await press(t.play.back)

// ---- "see how I decide": the sliders move the real model
await press(t.home.ask)
await shot('how-i-decide')
const lab = async (lifts, pause) => {
  await js(`slide(0, ${lifts}); slide(1, ${pause})`)
  await sleep(250)
  return (await text('.lab [role=status]')).replace(/\s+/g, ' ')
}
const none = await lab(0, 0.4)
const quick = await lab(1, 0.2)
const few = await lab(2, 0.4)
const many = await lab(10, 1.5)
console.log(`   sliders: 0 lifts -> ${none.slice(0, 60)} | 1 lift, 0.2 s -> ${few.slice(0, 60)} | 10 lifts, 1.5 s -> ${many.slice(0, 60)}`)
expect('sliders: no lift at all gives no result', none.includes(t.result.noResultTitle))
expect('sliders: one quick lift is too little pause to time: no result', quick.includes(t.result.noResultTitle))
expect('sliders: two short lifts are "usual pattern"', few.includes(t.verdicts.typical.title))
expect('sliders: ten long pauses is "worth mentioning"', many.includes(t.verdicts.mention.title))
await press(t.ask.back)

// ---- the check itself
await press(t.home.start)
await shot('guide')
await press(t.guide.skip)
await shot('ready')
await press(t.ready.begin)
await shot('practice')
// Practice done badly first: Tinta says what she saw and offers another go.
await task(2, { lifts: 5, seconds: 1.6, pause: 0.15 })
await press(t.task.done)
await shot('practice-not-as-asked')
expect('practice with five lifts: Tinta says so', (await says()).includes('5'))
await press(t.check.again)
await task(2, { seconds: 1.6 })
await press(t.task.done)
await press(t.task.next)
await task(3, { seconds: 1.4 })
await press(t.task.done)
await press(t.task.next)
// One lap of the circle instead of four.
await task(5, { amount: 0.25, seconds: 0.8 })
await press(t.task.done)
await shot('circle-not-as-asked')
expect('one lap of the circle: Tinta asks for the task again', await has(t.check.again))
await press(t.check.again)
await task(5, { seconds: 3 })
await shot('circle')
await press(t.task.done)
await press(t.task.next)
await task(9, { lifts: 3, seconds: 3, pause: 0.7 })
await shot('loops')
await press(t.task.done)
await sleep(1200)
await shot('invisible-ink')
// ---- a reload in the middle of the check (a call, a pull on the screen): back at the same step, writing kept
const flat = async (selector) => (await text(selector)).replace(/\s+/g, ' ')
const measured = await flat('.stats')
await reload()
expect('reloaded on the replay of a task: same step, same numbers, and Tinta says she kept the writing',
  (await text('.step')) === t.task.step(4, 5, t.tasks[9].title) && (await flat('.stats')) === measured && (await text('main')).includes(t.task.back))
await shot('back-after-reload')
await press(t.task.next)
expect('one step later Tinta no longer says "welcome back"', !(await text('main')).includes(t.task.back))
await task(16, { amount: 0.4, seconds: 1 })
await reload()
expect('reloaded while writing a task: that task starts again on an empty sheet',
  (await text('.step')) === t.task.step(5, 5, t.tasks[16].title) && (await js(`document.querySelector('main button.primary').disabled`)) === true && (await text('main')).includes(t.task.back))
await task(16, { seconds: 2 })
await press(t.task.done)
await press(t.task.seeResult)
await shot('closer-look')
await press(t.closer.more)
for (const taskId of [6, 22, 23]) {
  await task(taskId, { seconds: 2 })
  await press(t.task.done)
  await press(taskId === 23 ? t.task.seeResult : t.task.next)
}
await shot('result')
expect('a check done as asked ends with a number on the scale', await js(`Boolean(document.querySelector('.meter'))`))
const number = await text('.meter + .fine')
const votes = await flat('.votes')
await reload()
expect('reloaded on the result: the same result is still there, closer look and all', Boolean(number) && (await text('.meter + .fine')) === number && (await flat('.votes')) === votes)
// What comes out of the printer: the result and the note for the doctor, nothing else.
await cdp('Emulation.setEmulatedMedia', { media: 'print' })
await shot('printed-note')
expect('printed: the note for the doctor is there and the buttons are not', (await js(`getComputedStyle(document.querySelector('.note')).display !== 'none' && [...document.querySelectorAll('button')].every(b => b.offsetParent === null)`)) === true)
await cdp('Emulation.setEmulatedMedia', { media: '' })
await js(`document.querySelector('.history')?.scrollIntoView({ block: 'center' })`)
await sleep(500)
writeFileSync(join(out, `${String(++n).padStart(2, '0')}-history.png`), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))

if (url.includes('friends')) {
  // Invited testers: fill in the form and press Send; the share sheet is replaced by a recorder.
  await js(`window.shared = null; navigator.share = async (d) => { window.shared = d.text }`)
  await js(`type('input[type=text]', 'Test person'); type('textarea.words', 'Easy to follow.')`)
  await sleep(300)
  await press(t.friends.send)
  const sent = (await js('window.shared')) ?? ''
  expect('friends mode: the message has the name, the result and the timings', sent.includes('Test person') && sent.includes('"tasks"') && sent.includes('"laps"'))
}
if (url.includes('study')) {
  // Study mode: saving the volunteer keeps one line of timings on the phone.
  await press(t.study.save)
  expect('study mode: the volunteer is saved on the phone and can be copied', (await js(`JSON.parse(localStorage.getItem('tinta-study')).length`)) === 1 && (await has(t.study.copyAll(1))))
  await js(`localStorage.removeItem('tinta-study')`)
}

// ---- a second, quick run where things are left undone
await press(t.result.restart)
await reload()
expect('after "start again", a reload shows the first screen and not the old check', (await text('h1')) === t.home.title)
await press(t.home.start)
await press(t.guide.skip)
await press(t.ready.begin)
for (const taskId of [2, 3]) {
  await task(taskId, { seconds: 1.2 })
  await press(t.task.done)
  await press(t.task.next)
}
await task(5, { amount: 0.25, seconds: 0.8 })
await press(t.task.done)
await press(t.check.keep)
await task(9, { seconds: 2 })
await press(t.task.done)
await press(t.task.next)
// The word in a single drag: on a phone that leaves no pause to time, and Tinta asks for it letter by letter.
await task(16, { lifts: 0, seconds: 2 })
await press(t.task.done)
await shot('word-no-pause')
expect('the word in a single drag: Tinta asks for it again', await has(t.check.again))
await press(t.check.again)
await task(16, { seconds: 2 })
await press(t.task.done)
await press(t.task.seeResult)
await shot('no-result')
expect('a circle left at one lap: no result and no number', (await text('h1')) === t.result.noResultTitle && !(await js(`Boolean(document.querySelector('.meter'))`)))
// From "no result", only the missing task is done again; everything else that was written is kept.
await press(t.result.redo(1))
await task(5, { seconds: 3 })
await press(t.task.done)
expect('the circle done again: Tinta says it is done now', (await says()) === t.check.redone)
await press(t.task.seeResult)
if (await has(t.closer.stop)) await press(t.closer.stop)
await shot('result-after-redo')
expect('after doing only the circle again there is a number', await js(`Boolean(document.querySelector('.meter'))`))

// ---- the rest of the app
await press(t.result.restart)
await press(t.home.cases)
await press(t.result.mistake)
await shot('real-case-mistake')
await press(t.result.home)
await press(t.home.ask)
await js(`document.querySelectorAll('details')[3].open = true`)
await js(`document.querySelectorAll('details')[3].scrollIntoView({ block: 'start' })`)
await sleep(400)
writeFileSync(join(out, `${String(++n).padStart(2, '0')}-ask-tinta.png`), Buffer.from((await cdp('Page.captureScreenshot', { format: 'png' })).data, 'base64'))

// Chrome refuses to vibrate, and to ask "leave the page?", for touches that no finger made: that is this test, not the app.
for (const e of errors) if (!String(e).includes('navigator.vibrate') && !String(e).includes("'beforeunload'")) problems.push('error in the page: ' + String(e).slice(0, 160))
console.log(problems.length ? `\n${problems.length} PROBLEM(S):\n  ` + problems.join('\n  ') : `\nThe whole walk went through in ${lang} at ${W}x${H}: no missing button, nothing sticking out, no error in the page.`)
ws.close()
chrome.kill()
process.exit(problems.length ? 1 : 0)
