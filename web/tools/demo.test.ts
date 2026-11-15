// The example Tinta draws on the sheet before each task (src/lib/demo.ts).
// Two promises: what she shows is something she herself accepts, and she never gives the answer away.
//
//   npx vite-node tools/demo.test.ts        (also part of npm test)
import assert from 'node:assert/strict'
import { check, laps, les, passes } from '../src/lib/check'
import { asStrokes, demoFor, duration, type Step } from '../src/lib/demo'
import { EXTRA_IDS, TASK_IDS, WARMUP_IDS } from '../src/lib/model'
import { STRINGS } from '../src/lib/strings'

let passed = 0
const test = (name: string, run: () => void) => {
  run()
  passed++
  console.log('ok  ' + name)
}

// A usual phone, the smallest phone the app is laid out for, and a laptop.
const SHEETS = [{ w: 358, h: 354 }, { w: 288, h: 198 }, { w: 540, h: 378 }]
const ALL = [...WARMUP_IDS, ...TASK_IDS, ...EXTRA_IDS]
const letters = (steps: Step[]) => steps.filter((s) => s.kind === 'letter').map((s) => (s as Extract<Step, { kind: 'letter' }>).ch).join('')

test("the example of each drawn task passes Tinta's own check of that task, on every size of sheet", () => {
  for (const sheet of SHEETS)
    for (const task of [2, 3, 5, 9]) {
      const strokes = asStrokes(demoFor(task, sheet, { example: 'sun' }))
      assert.equal(strokes.length, 1, `task ${task}: the example is done in one go`)
      assert.equal(check(task, strokes, sheet), null, `task ${task} on a sheet of ${sheet.w} x ${sheet.h}`)
    }
})

test('the examples show four of everything: four lines, four laps, four "le"', () => {
  for (const sheet of SHEETS) {
    assert.equal(passes(asStrokes(demoFor(2, sheet, { example: '' })), sheet, 'x'), 4)
    assert.equal(passes(asStrokes(demoFor(3, sheet, { example: '' })), sheet, 'y'), 4)
    assert.ok(Math.abs(laps(asStrokes(demoFor(5, sheet, { example: '' }))) - 4) < 0.1)
    assert.ok(Math.abs(les(asStrokes(demoFor(9, sheet, { example: '' })), sheet) - 4) <= 0.5)
    for (const task of [2, 3, 5, 9]) assert.deepEqual(demoFor(task, sheet, { example: '' }).steps.map((s) => (s.kind === 'stroke' ? s.count?.n : 0)), [1, 2, 3, 4], `task ${task} counts to four`)
  }
})

// A volunteer's question, and a fair one: "it only goes once, not there and back, does it?" The four passes were
// drawn exactly on top of each other, so the eye saw one line. These two keep them apart.
test('a line gone over four times is seen as four: the passes meet on the dots, part in between, and each says which way it goes', () => {
  for (const sheet of SHEETS)
    for (const [task, along, across] of [[2, 'x', 'y'], [3, 'y', 'x']] as const) {
      const steps = demoFor(task, sheet, { example: '' }).steps as Extract<Step, { kind: 'stroke' }>[]
      const [length, width] = along === 'x' ? [sheet.w, sheet.h] : [sheet.h, sheet.w]
      const dots = [length * 0.18, length * 0.82]
      const middles = steps.map((s) => s.pts[(s.pts.length - 1) / 2][across])
      for (let i = 1; i < middles.length; i++) assert.ok(middles[i] - middles[i - 1] >= 4, `task ${task}: line ${i + 1} lies on line ${i}`)
      steps.forEach((s, i) => {
        const [first, last] = [s.pts[0], s.pts[s.pts.length - 1]]
        assert.ok(Math.abs(first[along] - dots[i % 2]) < 0.5 && Math.abs(last[along] - dots[1 - (i % 2)]) < 0.5, `task ${task}: line ${i + 1} goes from one dot to the other`)
        assert.ok(Math.abs(first[across] - width / 2) < 0.5 && Math.abs(last[across] - width / 2) < 0.5, `task ${task}: line ${i + 1} starts and ends on a dot`)
        assert.equal(s.count?.dir?.[along], i % 2 ? -1 : 1, `task ${task}: the arrow of line ${i + 1}`)
      })
    }
})

test('four laps of the circle are seen as four: each lap leaves its own line, and the last one ends where the first began', () => {
  for (const sheet of SHEETS) {
    const steps = demoFor(5, sheet, { example: '' }).steps as Extract<Step, { kind: 'stroke' }>[]
    for (let i = 1; i < steps.length; i++) {
      const apart = Math.max(...steps[i].pts.map((q, k) => Math.hypot(q.x - steps[i - 1].pts[k].x, q.y - steps[i - 1].pts[k].y)))
      assert.ok(apart >= 4, `lap ${i + 1} lies on lap ${i}`)
    }
    const [start, end] = [steps[0].pts[0], steps[3].pts[steps[3].pts.length - 1]]
    assert.ok(Math.hypot(start.x - end.x, start.y - end.y) < 0.5)
  }
})

test('every task has an example, it fits in the sheet and it is short', () => {
  for (const t of Object.values(STRINGS))
    for (const sheet of SHEETS)
      for (const task of ALL) {
        const demo = demoFor(task, sheet, { prompt: t.tasks[task].prompt, example: t.task.exampleWord })
        assert.ok(demo.steps.length > 0, `task ${task}`)
        assert.ok(duration(demo) <= 6000, `task ${task} lasts ${duration(demo)} ms`)
        for (const s of demo.steps) {
          const points = s.kind === 'stroke' ? s.pts : s.kind === 'letter' ? [s.at] : [s.to]
          for (const p of points) assert.ok(p.x >= 0 && p.x <= sheet.w && p.y >= 0 && p.y <= sheet.h, `task ${task}: a point outside a sheet of ${sheet.w} x ${sheet.h}`)
        }
      }
})

test('where the task asks to lift the finger, the example lifts it after every letter', () => {
  for (const t of Object.values(STRINGS))
    for (const task of [16, 6, 10, 18]) {
      const steps = demoFor(task, SHEETS[0], { prompt: t.tasks[task].prompt, example: t.task.exampleWord }).steps
      const written = steps.filter((s) => s.kind === 'letter').length
      assert.ok(written >= 3, `task ${task}`)
      assert.equal(steps.filter((s) => s.kind === 'lift').length, written - 1, `task ${task}`)
      steps.forEach((s, i) => assert.equal(s.kind, i % 2 ? 'lift' : 'letter', `task ${task}, step ${i}`))
    }
})

test('the example never gives the answer away: another word for "backwards" and for "what is this?"', () => {
  for (const [lang, t] of Object.entries(STRINGS)) {
    const word = t.tasks[16].prompt!
    const shown = letters(demoFor(16, SHEETS[0], { prompt: word, example: t.task.exampleWord }).steps)
    assert.equal(shown, [...t.task.exampleWord].reverse().join(''), lang)
    assert.notEqual(shown, [...word].reverse().join(''), `${lang}: the example writes the answer`)
    const named = letters(demoFor(18, SHEETS[0], { example: t.task.exampleWord }).steps)
    assert.equal(named, t.task.exampleWord, lang)
    assert.ok(!['chair', 'silla'].includes(named), `${lang}: the example names the object in the picture`)
  }
})

test('for letters and words that are only copied, the example writes what is on the screen', () => {
  for (const t of Object.values(STRINGS)) {
    assert.equal(letters(demoFor(6, SHEETS[0], { prompt: t.tasks[6].prompt, example: '' }).steps), 'lmp')
    assert.equal(letters(demoFor(10, SHEETS[0], { prompt: t.tasks[10].prompt, example: '' }).steps), t.tasks[10].prompt)
  }
})

console.log(`\n${passed} checks of the examples passed.`)
