// The geometry behind "can this task be compared with the study?" (src/lib/check.ts), one behaviour per test.
// The writing comes from shapes.mjs: drawings made by a formula, where the right answer is known exactly.
import assert from 'node:assert/strict'
import { check, laps, les, passes, travelled, turns, type Issue } from '../src/lib/check'
import type { Stroke } from '../src/lib/ink'
import { SHEET, circle, lines, loops, perform, taps, toStrokes } from './shapes.mjs'

let passed = 0
function test(name: string, run: () => void) {
  run()
  passed++
  console.log('ok  ' + name)
}

type Path = number[][]
const ink = (paths: Path[]): Stroke[] => toStrokes(paths.map((pts) => ({ pts, ms: 600, gap: 300 })))
const done = (task: number, how = {}): Stroke[] => toStrokes(perform(task, how))
const issue = (task: number, how = {}): Issue | null => check(task, done(task, how), SHEET)
const near = (got: number, want: number, by: number, what: string) => assert.ok(Math.abs(got - want) <= by, `${what}: got ${got.toFixed(2)}, wanted ${want}`)

// ---- laps of the circle
test('laps: one, two, three, four and six times round are counted as that many', () => {
  for (const n of [1, 2, 2.5, 3, 4, 6]) near(laps(ink(circle(n))), n, 0.1, `${n} laps`)
})
test('laps: lifting the finger on the way round changes nothing', () => {
  for (let lifts = 0; lifts <= 12; lifts++) near(laps(done(5, { lifts })), 4, 0.15, `${lifts} lifts`)
})
test('laps: a circle drawn in a corner, very small or very big still counts', () => {
  for (const where of ['corner', 'tiny', 'big']) near(laps(done(5, { where })), 4, 0.15, where)
})
test('laps: the other way round counts the same', () => {
  near(laps(ink(circle(4).map((path: Path) => [...path].reverse()))), 4, 0.1, 'reversed')
})
test('laps: a shaky hand does not add or lose a lap', () => {
  near(laps(done(5, { shaky: true })), 4, 0.25, 'shaky')
})
test('laps: taps, a dash and a zigzag are not laps', () => {
  assert.ok(laps(ink(taps(30))) < 0.5, 'thirty taps')
  assert.ok(laps(done(5, { do: 'dash' })) < 0.5, 'a dash')
  assert.ok(laps(done(5, { do: 'scribble' })) < 1, 'a zigzag')
})

// ---- lines between the practice dots
test('passes: one to four lines between the dots are counted as that many', () => {
  for (const n of [1, 2, 3, 4]) {
    assert.equal(passes(ink(lines('x', n)), SHEET, 'x'), n, `${n} lines across`)
    assert.equal(passes(ink(lines('y', n)), SHEET, 'y'), n, `${n} lines up and down`)
  }
})
test('passes: lifting in the middle of a line does not lose the line', () => {
  assert.equal(passes(done(2, { lifts: 2 }), SHEET, 'x'), 4)
  assert.equal(passes(done(3, { lifts: 4 }), SHEET, 'y'), 4)
})
test('passes: four separate lines, each drawn left to right, are four lines (the jumps back are not lines)', () => {
  const [once] = lines('x', 1)
  assert.equal(passes(ink([once, once, once, once]), SHEET, 'x'), 4)
})
test('passes: lines that do not reach the dots are not counted', () => {
  assert.equal(passes(done(2, { where: 'tiny' }), SHEET, 'x'), 0)
})
test('passes: lines across are not lines up and down', () => {
  assert.equal(passes(ink(lines('x', 4)), SHEET, 'y'), 0)
})

// ---- "le" four times
test('loops: one to four "le" are counted as that many', () => {
  for (const n of [1, 2, 3, 4]) near(les(ink(loops(n)), SHEET), n, 0.26, `${n} "le"`)
})
test('loops: lifting between or inside the "le" changes nothing', () => {
  for (let lifts = 0; lifts <= 12; lifts++) near(les(done(9, { lifts }), SHEET), 4, 0.26, `${lifts} lifts`)
})
test('loops: small writing and a shaky hand are counted the same', () => {
  near(les(done(9, { where: 'tiny' }), SHEET), 4, 0.26, 'tiny')
  near(les(done(9, { shaky: true }), SHEET), 4, 0.6, 'shaky')
})

// ---- how much was written
test('turns: writing made very small still counts as the whole word or number', () => {
  // Small writing loses some turns (they get smaller than a shaky finger's wobble), but never enough to look unfinished.
  for (const task of [16, 6, 10, 18]) assert.equal(issue(task, { where: 'tiny' }), null, `task ${task}`)
})
test('turns: lifting the finger never makes the writing look smaller', () => {
  for (const task of [16, 6, 10, 18]) for (let lifts = 1; lifts <= 15; lifts++) assert.ok(turns(done(task, { lifts }), SHEET) >= turns(done(task), SHEET) - 1, `task ${task}, ${lifts} lifts`)
})
test('travelled: taps go nowhere, writing does', () => {
  assert.ok(travelled(ink(taps(30))) < 40)
  assert.ok(travelled(done(16)) > 300)
})

// ---- the decision for each task
test('check: every task done as asked has nothing wrong with it', () => {
  for (const task of [2, 3, 5, 9, 16, 6, 10, 18]) assert.equal(issue(task), null, `task ${task}`)
})
test('check: each kind of problem is named for what it is', () => {
  assert.deepEqual(issue(5, { amount: 0.25 }), { kind: 'laps', seen: 1, asked: 4 })
  assert.deepEqual(issue(5, { amount: 0.5 }), { kind: 'laps', seen: 2, asked: 4 })
  assert.deepEqual(issue(9, { amount: 0.5 }), { kind: 'loops', seen: 2, asked: 4 })
  assert.deepEqual(issue(2, { amount: 0.25 }), { kind: 'passes', seen: 1, asked: 4 })
  assert.deepEqual(issue(3, { lifts: 5 }), { kind: 'lifted', seen: 5 })
  assert.deepEqual(issue(16, { amount: 0.4 }), { kind: 'part' })
  assert.deepEqual(issue(16, { do: 'taps', n: 30 }), { kind: 'little' })
  assert.deepEqual(issue(16, { lifts: 0 }), { kind: 'joined', lifted: false })
  assert.deepEqual(issue(10, { lifts: 0 }), { kind: 'joined', lifted: false })
})
test('check: the limit is two and a half of the four repetitions', () => {
  assert.equal(issue(5, { amount: 0.6 })?.kind, 'laps')
  assert.equal(issue(5, { amount: 0.65 }), null)
  assert.equal(issue(9, { amount: 0.5 })?.kind, 'loops')
  assert.equal(issue(9, { amount: 0.75 }), null)
  assert.equal(issue(2, { amount: 0.5 })?.kind, 'passes')
  assert.equal(issue(2, { amount: 0.75 }), null)
})
test('check: the circle and the loops in one go are fine (that is what they ask); only words and numbers need a pause', () => {
  assert.equal(issue(5, { lifts: 0 }), null)
  assert.equal(issue(9, { lifts: 0 }), null)
})
test('check: lifting the finger, however often, is never "not done" in a task that counts', () => {
  for (const task of [5, 9]) for (let lifts = 1; lifts <= 20; lifts++) assert.equal(issue(task, { lifts }), null, `task ${task}, ${lifts} lifts`)
  // Words and numbers: with very few lifts there may be too little pause to time, but the writing is never "missing".
  for (const task of [16, 6, 10, 18])
    for (let lifts = 1; lifts <= 20; lifts++) {
      const found = issue(task, { lifts })
      assert.ok(found === null || found.kind === 'joined', `task ${task}, ${lifts} lifts: ${found?.kind}`)
    }
})
test('check: a word with one quick lift has less time in the air than anyone in the study: no pause worth timing', () => {
  // The study's lowest on the backwards word is 12.5% of the task. One lift of a quarter of a second in 3.5 s is 7%.
  assert.deepEqual(issue(16, { lifts: 1, pause: 0.25 }), { kind: 'joined', lifted: true })
  // A break of a tenth of a second is a skip of the finger, not a lift at all.
  assert.deepEqual(issue(16, { lifts: 1, pause: 0.1 }), { kind: 'joined', lifted: false })
  // Letter by letter, as with a pen: fine.
  assert.equal(issue(16, { lifts: 4, pause: 0.45 }), null)
})
test('check: a finger that skips on the glass is not lifting: the circle and the loops stay as they are', () => {
  assert.equal(issue(5, { lifts: 4, pause: 0.1 }), null)
  assert.equal(issue(9, { lifts: 4, pause: 0.1 }), null)
  assert.equal(issue(2, { lifts: 6, pause: 0.1 }), null) // six skips on the practice line are not "you lifted six times"
})
test('check: only the practice lines say anything about lifting, and only from three lifts', () => {
  assert.equal(issue(2, { lifts: 2 }), null)
  assert.equal(issue(2, { lifts: 3 })?.kind, 'lifted')
})
test('check: nothing written, a single dot and thirty taps are all "hardly any writing"', () => {
  for (const task of [2, 3, 5, 9, 16, 6, 10, 18]) {
    assert.deepEqual(check(task, [], SHEET), { kind: 'little' }, `task ${task}, nothing`)
    assert.deepEqual(check(task, [[{ x: 100, y: 100, t: 0 }]], SHEET), { kind: 'little' }, `task ${task}, a dot`)
    assert.deepEqual(issue(task, { do: 'taps', n: 30 }), { kind: 'little' }, `task ${task}, taps`)
  }
})

console.log(`\n${passed} checks of the geometry passed.`)
