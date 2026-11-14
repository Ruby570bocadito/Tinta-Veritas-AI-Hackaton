// A check that survives a reload (src/lib/resume.ts): what comes back, what starts again, and that a copy
// that is old or damaged never gets into the app.
//
//   npx vite-node tools/resume.test.ts        (also part of npm test)
import assert from 'node:assert/strict'
import type { Stroke } from '../src/lib/ink'
import { judge } from '../src/lib/judge'
import { KEEP_MS, pack, unpack, type Progress } from '../src/lib/resume'
import { SHEET, perform, toStrokes } from './shapes.mjs'

const ORDER = [2, 3, 5, 9, 16, 6, 22, 23] // the task behind each screen of the check, as in App.tsx
const NOW = 1_800_000_000_000

let passed = 0
const test = (name: string, run: () => void) => {
  run()
  passed++
  console.log('ok  ' + name)
}

/** A person who has written these tasks as asked, one minute apart. */
function written(ids: number[], place: Progress['place'], closer = false): Progress {
  const ink: Record<number, Stroke[]> = {}
  const sheets: Record<number, typeof SHEET> = {}
  ids.forEach((id, i) => {
    ink[id] = toStrokes(perform(id, {}), SHEET, i * 60_000)
    sheets[id] = SHEET
  })
  return { place, ink, sheets, closer, tries: {}, warned: {}, redo: [] }
}
const back = (p: Progress, later = 1000) => unpack(pack(p, NOW), NOW + later, ORDER)
const text = (change: (raw: Record<string, unknown>) => void) => {
  const raw = JSON.parse(pack(written([2, 3, 5], { name: 'task', index: 2, review: true }), NOW))
  change(raw)
  return JSON.stringify(raw)
}

test('a finished check comes back exactly as it was, and gets the same answer to the last decimal', () => {
  const before = { ...written([2, 3, 5, 9, 16], { name: 'result' }), tries: { 5: 1 }, warned: { 5: 'laps' } }
  const after = back(before)
  assert.deepEqual(after, before)
  assert.deepEqual(judge(after!.ink, after!.sheets, false), judge(before.ink, before.sheets, false))
})

test('reloaded while writing a task: that task starts again with an empty sheet, the finished ones are kept', () => {
  const before = written([2, 3, 5, 9], { name: 'task', index: 3, review: false }) // half way through the loops
  const after = back(before)!
  assert.equal(after.ink[9], undefined)
  assert.deepEqual(after.ink[5], before.ink[5])
  assert.deepEqual(after.place, { name: 'task', index: 3, review: false })
})

test('reloaded on the replay of a task: that task was finished, so it is kept', () => {
  const before = written([2, 3, 5, 9], { name: 'task', index: 3, review: true })
  assert.deepEqual(back(before)!.ink[9], before.ink[9])
})

test('the closer look comes back with its three extra tasks and the list of tasks being done again', () => {
  const before = { ...written([2, 3, 5, 9, 16, 6, 22], { name: 'task', index: 7, review: false }, true), redo: [23] }
  const after = back(before)!
  assert.equal(after.closer, true)
  assert.deepEqual(after.redo, [23])
  assert.deepEqual(Object.keys(after.ink).map(Number).sort((a, b) => a - b), [2, 3, 5, 6, 9, 16, 22])
})

test('after half an hour away the check starts from the beginning', () => {
  const p = written([2, 3], { name: 'task', index: 2, review: false })
  assert.ok(back(p, KEEP_MS))
  assert.equal(back(p, KEEP_MS + 1), null)
})

test('nothing kept, a copy from another version, from the future, or that is not even JSON: ignored', () => {
  assert.equal(unpack(null, NOW, ORDER), null)
  assert.equal(unpack('', NOW, ORDER), null)
  assert.equal(unpack('not json', NOW, ORDER), null)
  assert.equal(unpack('{}', NOW, ORDER), null)
  assert.equal(unpack('[1, 2]', NOW, ORDER), null)
  assert.equal(unpack(text((raw) => (raw.v = 2)), NOW + 1, ORDER), null)
  assert.equal(unpack(text(() => {}), NOW - 1, ORDER), null)
  assert.ok(unpack(text(() => {}), NOW + 1, ORDER)) // the same copy, untouched, is fine
})

test('a step that does not exist is ignored', () => {
  for (const place of [
    { name: 'task', index: 5, review: false }, // the sixth screen only exists in the closer look
    { name: 'task', index: -1, review: false },
    { name: 'task', index: 2.5, review: false },
    { name: 'task', index: 2 },
    { name: 'intro' },
    null,
  ])
    assert.equal(unpack(text((raw) => (raw.place = place)), NOW + 1, ORDER), null, JSON.stringify(place))
  const closer = text((raw) => {
    raw.closer = true
    raw.place = { name: 'task', index: 7, review: false }
  })
  assert.ok(unpack(closer, NOW + 1, ORDER))
  assert.equal(unpack(text((raw) => ((raw.closer = true), (raw.place = { name: 'task', index: 8, review: false }))), NOW + 1, ORDER), null)
})

test('writing that is not made of numbers, or belongs to a task that does not exist, is ignored', () => {
  const ink = (value: unknown) => unpack(text((raw) => ((raw.ink as Record<string, unknown>)[5] = value)), NOW + 1, ORDER)
  assert.equal(ink('a circle'), null)
  assert.equal(ink([[[1, 2]]]), null) // a point with no time
  assert.equal(ink([[[1, 2, 'now']]]), null)
  assert.equal(ink([[[1, 2, null]]]), null) // what NaN and Infinity turn into as text
  assert.equal(ink([[{ x: 1, y: 2, t: 3 }]]), null)
  assert.ok(ink([[[1, 2, 3]]]))
  assert.equal(unpack(text((raw) => ((raw.ink as Record<string, unknown>)[7] = [])), NOW + 1, ORDER), null)
  assert.equal(unpack(text((raw) => ((raw.sheets as Record<string, unknown>)[5] = { w: 0, h: 300 })), NOW + 1, ORDER), null)
  assert.equal(unpack(text((raw) => (raw.redo = [99])), NOW + 1, ORDER), null)
  assert.equal(unpack(text((raw) => (raw.tries = { 5: -1 })), NOW + 1, ORDER), null)
})

console.log(`\n${passed} checks passed.`)
