// What does Tinta say to people who do the check wrong?
//
// A tester did the tasks badly on purpose (nine touches on the practice line, one lap of the circle,
// scribbles for the rest) and was told "usual pattern, 21/100". The model only reads pauses and lifts, so it
// had no way to notice. check.ts now looks first at whether each task can be compared with the study at all.
// Nine more testers (language models, each playing a different kind of user) then tried to fool it with the
// simulator in try.ts; what they found is in the cases below.
//
// This file plays made-up people through the app's own logic, prints what each one is told, and fails if a
// rule below is broken.
//
//   npm run personas        (also part of npm test)
import assert from 'node:assert/strict'
import type { Measures } from '../src/lib/ink'
import { TASK_IDS, onScale, predict, verdict } from '../src/lib/model'
import { play, type Person } from './people'

type Case = Person & { name: string; rule?: 'left alone' | 'no result' | 'gets a result' }

const scribbles = { 9: { do: 'scribble', amount: 0.6 }, 16: { do: 'scribble', amount: 0.6 } } as const
const PEOPLE: Case[] = [
  // People who do the tasks: the checks must leave them alone.
  { name: 'Does every task as asked', rule: 'left alone' },
  { name: 'Three laps of the circle instead of four (lost count)', tasks: { 5: { amount: 0.75 } }, rule: 'left alone' },
  { name: 'Six laps of the circle', tasks: { 5: { amount: 1.5 } }, rule: 'left alone' },
  { name: 'Draws the four circles in a corner, not over the printed one', tasks: { 5: { where: 'corner' } }, rule: 'left alone' },
  { name: 'Writes "le" three times instead of four', tasks: { 9: { amount: 0.75 } }, rule: 'left alone' },
  { name: 'Shaky hand, every task done', all: { shaky: true }, rule: 'left alone' },
  { name: 'Writes everything very small', tasks: { 5: { where: 'tiny' }, 9: { where: 'tiny' }, 16: { where: 'tiny' } }, rule: 'left alone' },
  { name: 'Lifts once in the middle of each practice line and of the circle', tasks: { 2: { lifts: 1 }, 3: { lifts: 1 }, 5: { lifts: 1 } }, rule: 'left alone' },
  { name: 'Hesitant: every task done, 1.5 s in the air at each lift, lifts between each "le"', all: { pause: 1.5 }, tasks: { 9: { lifts: 3, pause: 1.5 } }, rule: 'left alone' },
  // The very thing the model looks for must never be mistaken for "did not do the task".
  { name: 'Lifts the finger 12 times in every scored task (what many patients do)', tasks: { 5: { lifts: 12 }, 9: { lifts: 12 }, 16: { lifts: 12 } }, rule: 'left alone' },
  // People who do not do the tasks: no result, whatever the models think.
  { name: "The first tester's try: 9 touches on the first line, one lap, scribbles; keeps everything", tasks: { 2: { lifts: 8 }, 5: { amount: 0.25 }, ...scribbles }, rule: 'no result' },
  { name: 'The same person, but tries again each time Tinta asks', tasks: { 2: { lifts: 8 }, 5: { amount: 0.25 }, ...scribbles }, onWarning: 'retry', rule: 'gets a result' },
  { name: 'One lap of the circle, everything else as asked', tasks: { 5: { amount: 0.25 } }, rule: 'no result' },
  { name: 'Two laps of the circle, everything else as asked', tasks: { 5: { amount: 0.5 } }, rule: 'no result' },
  { name: 'Writes "le" twice instead of four times', tasks: { 9: { amount: 0.5 } }, rule: 'no result' },
  { name: 'Copies two of the five letters of the word', tasks: { 16: { amount: 0.4 } }, rule: 'no result' },
  { name: 'A zigzag instead of the loops', tasks: { 9: { do: 'scribble' } }, rule: 'no result' },
  { name: 'Taps thirty times on every task', all: { do: 'taps', n: 30 }, rule: 'no result' },
  { name: 'One short dash on every task', all: { do: 'dash' }, rule: 'no result' },
  // A phone cannot see a finger in the air. With no lift there is no pause to time: a value the model never saw.
  { name: 'Does every task and never lifts the finger, the word too (3 of our first 8 phone volunteers)', all: { lifts: 0 }, rule: 'no result' },
  { name: 'The same, but writes the word again letter by letter when Tinta asks', all: { lifts: 0 }, onWarning: 'retry', rule: 'gets a result' },
  { name: 'Lifts ten times in the loops but writes the word in a single drag', all: { lifts: 0 }, tasks: { 9: { lifts: 10, pause: 1.5 } }, rule: 'no result' },
  { name: 'Holds the finger down for a minute on each task, never lifting', all: { lifts: 0, seconds: 60 }, rule: 'no result' },
  // Found by a judge in ten minutes, and fixed by cleaning what the phone hands to the model.
  { name: 'The word in one drag except for one quick lift (a quarter of a second)', tasks: { 16: { lifts: 1, pause: 0.25 } }, rule: 'no result' },
  { name: 'A finger that skips on the glass: four breaks of a tenth of a second in the circle and in the loops', tasks: { 5: { lifts: 4, pause: 0.1 }, 9: { lifts: 4, pause: 0.1 } }, rule: 'left alone' },
  // Holes that are still open. Tinta cannot read: she counts laps, loops and turns, not letters.
  { name: 'STILL OPEN. Does lines and circle, then scribbles a long zigzag with a few lifts instead of writing', tasks: { 9: { do: 'scribble', amount: 1.5 }, 16: { do: 'scribble', amount: 1.5, lifts: 3 } } },
  { name: 'STILL OPEN. Does every task but lifts the finger 15 times in each, on purpose', all: { lifts: 15, pause: 0.3 } },
  { name: 'STILL OPEN. Writes very slowly with long stops, finger down, lifting only between letters', all: { seconds: 60 } },
]

const rows = PEOPLE.map((person) => ({ person, played: play(person) }))

console.log('What Tinta tells made-up people who do the check in different ways\n')
for (const { person, played } of rows) {
  console.log(person.name)
  console.log(`    along the way: ${played.warned.length ? `asks about task${played.warned.length > 1 ? 's' : ''} ${played.warned.join(', ')}${played.retried.length ? ' (the person tries again)' : ' (the person keeps them)'}` : 'nothing'}`)
  console.log(`    at the end:    ${played.said}`)
  console.log(`    model alone:   ${played.modelAlone}\n`)
}

let passed = 0
const test = (name: string, run: () => void) => {
  run()
  passed++
  console.log('ok  ' + name)
}
const with_ = (rule: Case['rule']) => rows.filter((r) => r.person.rule === rule)

test('people who do the tasks are left alone: Tinta asks nothing and gives a result', () => {
  for (const { person, played } of with_('left alone')) {
    assert.deepEqual(played.warned, [], person.name)
    assert.equal(played.answer.noResult.length, 0, person.name)
  }
})
test('lifting the finger a lot in a scored task is never treated as "not done"', () => {
  const lifter = rows.find((r) => r.person.name.startsWith('Lifts the finger 12 times'))!
  assert.deepEqual(lifter.played.warned, [])
  assert.equal(lifter.played.answer.kind, 'mention')
})
test('a scored task that was not done, or has no pause to time, means no result, whatever the models say', () => {
  for (const { person, played } of with_('no result')) {
    assert.ok(played.answer.noResult.length > 0, person.name)
    assert.equal(played.answer.kind, 'unsure', person.name)
  }
})
test('a finger that skips on the glass gets the same answer as one that does not', () => {
  const plain = rows.find((r) => r.person.name === 'Does every task as asked')!.played.answer
  const skipping = rows.find((r) => r.person.name.startsWith('A finger that skips'))!.played.answer
  assert.equal(skipping.kind, plain.kind)
  assert.ok(Math.abs(skipping.p - plain.p) < 0.02, `${skipping.p} against ${plain.p}`)
})
test('doing it again as asked gives a result', () => {
  for (const { person, played } of with_('gets a result')) assert.equal(played.answer.noResult.length, 0, person.name)
})
test('nobody is ever given "usual pattern" or "worth mentioning" with a task that cannot be compared', () => {
  for (const { person, played } of rows) if (played.answer.noResult.length) assert.equal(played.answer.kind, 'unsure', person.name)
})
test('in the short check, more lifts or longer pauses never give a lower number', () => {
  // The same made-up writer as the sliders in the app: the same lifts and pauses in each scored task.
  const number = (lifts: number, pause: number) => {
    const byTask: Record<number, Measures> = {}
    for (const id of TASK_IDS) byTask[id] = { air_time: 1000 * lifts * pause, paper_time: 5000, total_time: 5000 + 1000 * lifts * pause, num_of_pendown: lifts + 1 }
    return predict(byTask)
  }
  for (let lifts = 1; lifts <= 12; lifts++)
    for (let pause = 0.1; pause <= 3; pause += 0.1) {
      assert.ok(number(lifts, pause + 0.1) >= number(lifts, pause) - 0.005, `longer pause: ${lifts} lifts, ${pause.toFixed(1)} s`)
      assert.ok(number(lifts + 1, pause) >= number(lifts, pause) - 0.005, `one more lift: ${lifts} lifts, ${pause.toFixed(1)} s`)
    }
})
test('the number shown never contradicts the answer: 35 or under is "usual", 65 or over "worth mentioning"', () => {
  for (let p = 0; p <= 1; p += 0.0005) {
    const shown = onScale(p)
    const kind = verdict(p)
    assert.ok(kind === 'typical' ? shown <= 35 : kind === 'mention' ? shown >= 65 : shown > 35 && shown < 65, `${p.toFixed(4)} is "${kind}" but would show ${shown}`)
    assert.ok(Math.abs(shown - 100 * p) <= 1, `${p.toFixed(4)} would show ${shown}`)
  }
})
console.log(`\n${passed} rules hold for ${rows.length} made-up people. These are drawings made by a formula, not people.`)
