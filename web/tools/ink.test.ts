// Checks that the app measures writing correctly and that the model behaves as described.
// No test framework: plain assertions, run with `npm test`.
import assert from 'node:assert/strict'
import { SKIP_MS, gaps, joinSkips, measure, type Stroke } from '../src/lib/ink'
import { EXTRA_IDS, GREY_HI, GREY_LO, TASK_IDS, WARMUP_IDS, airShare, examples, isGrey, predict, predictCloser, verdict } from '../src/lib/model'
import type { Measures } from '../src/lib/ink'

let passed = 0
function test(name: string, run: () => void) {
  run()
  passed++
  console.log('ok  ' + name)
}

/** A stroke that starts at `start` ms and lasts `ms`, sampled every 10 ms. */
const stroke = (start: number, ms: number): Stroke =>
  Array.from({ length: ms / 10 + 1 }, (_, i) => ({ x: i, y: 0, t: start + i * 10 }))

test('nothing written measures as zero', () => {
  assert.deepEqual(measure([]), { air_time: 0, paper_time: 0, total_time: 0, num_of_pendown: 0 })
})

test('one stroke: all the time is on the screen', () => {
  assert.deepEqual(measure([stroke(1000, 500)]), { air_time: 0, paper_time: 500, total_time: 500, num_of_pendown: 1 })
})

test('two strokes with a pause: the pause is counted as time in the air', () => {
  const m = measure([stroke(0, 400), stroke(700, 200)])
  assert.deepEqual(m, { air_time: 300, paper_time: 600, total_time: 900, num_of_pendown: 2 })
  assert.equal(m.air_time + m.paper_time, m.total_time)
})

test('a single tap counts as a touch with no time on the screen', () => {
  const m = measure([stroke(0, 200), [{ x: 5, y: 5, t: 500 }]])
  assert.equal(m.num_of_pendown, 2)
  assert.equal(m.air_time, 300)
  assert.equal(m.total_time, 500)
})

test('the invisible ink has one jump per pause, with its length', () => {
  const g = gaps([stroke(0, 100), stroke(250, 100), stroke(900, 100)])
  assert.deepEqual(g.map((x) => x.ms), [150, 550])
})

test('share of time in the air is between 0 and 1 and safe when nothing was written', () => {
  assert.equal(airShare(measure([])), 0)
  const share = airShare(measure([stroke(0, 400), stroke(700, 200)]))
  assert.ok(Math.abs(share - 300 / 900) < 1e-9)
})

// A person described by the same measures in every task.
const person = (air: number, paper: number, touches: number) => {
  const byTask: Record<number, Measures> = {}
  for (const id of [...WARMUP_IDS, ...TASK_IDS, ...EXTRA_IDS]) {
    byTask[id] = { air_time: air, paper_time: paper, total_time: air + paper, num_of_pendown: touches }
  }
  return byTask
}

test('overall speed does not change the score (twice as slow, same answer)', () => {
  const normal = person(1500, 4000, 3)
  const slow = person(3000, 8000, 3)
  assert.ok(Math.abs(predict(normal) - predict(slow)) < 1e-12)
  assert.ok(Math.abs(predictCloser(normal).p - predictCloser(slow).p) < 1e-12)
})

test('more time in the air raises the score', () => {
  assert.ok(predict(person(4000, 4000, 3)) > predict(person(500, 4000, 3)))
})

test('more touches raise the score', () => {
  assert.ok(predict(person(1500, 4000, 9)) > predict(person(1500, 4000, 1)))
})

test('scores are probabilities', () => {
  for (const e of examples) {
    const byTask = e.measures as unknown as Record<number, Measures>
    for (const p of [predict(byTask), predictCloser(byTask).p]) assert.ok(p >= 0 && p <= 1)
  }
})

test('the three answers follow the grey zone', () => {
  assert.equal(verdict(GREY_LO - 0.01), 'typical')
  assert.equal(verdict((GREY_LO + GREY_HI) / 2), 'unsure')
  assert.equal(verdict(GREY_HI + 0.01), 'mention')
  assert.ok(isGrey(0.5) && !isGrey(0.1) && !isGrey(0.9))
})

test('when the three models pull far apart, the closer look is flagged as split', () => {
  for (const e of examples) {
    const { votes, split } = predictCloser(e.measures as unknown as Record<number, Measures>)
    const ps = votes.map((v) => v.p)
    assert.equal(split, Math.max(...ps) - Math.min(...ps) > 0.5)
  }
})

test('a finger that skips on the glass for a tenth of a second has not lifted: one touch, and the break counts as writing', () => {
  const skipped = [stroke(0, 400), stroke(500, 300)]
  assert.ok(100 < SKIP_MS)
  assert.deepEqual(measure(skipped), { air_time: 0, paper_time: 800, total_time: 800, num_of_pendown: 1 })
  assert.equal(gaps(skipped).length, 0)
  assert.equal(joinSkips(skipped).length, 1)
})

test('a pause of a fifth of a second is a lift', () => {
  const lifted = [stroke(0, 400), stroke(600, 300)]
  assert.deepEqual(measure(lifted), { air_time: 200, paper_time: 700, total_time: 900, num_of_pendown: 2 })
  assert.equal(gaps(lifted).length, 1)
})

test('four skips while tracing give the same measures as tracing in one go', () => {
  const oneGo = measure([stroke(0, 5000)])
  const skipping = measure([stroke(0, 1000), stroke(1100, 900), stroke(2100, 900), stroke(3100, 900), stroke(4100, 900)])
  assert.deepEqual(skipping, oneGo)
})

console.log(`\n${passed} checks passed`)
