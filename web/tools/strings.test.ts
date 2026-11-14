// English and Spanish must say the same things: same texts, same lists, nothing missing, nothing broken.
import assert from 'node:assert/strict'
import type { Issue } from '../src/lib/check'
import { counts, metrics } from '../src/lib/model'
import { STRINGS, type Strings } from '../src/lib/strings'

let passed = 0
function test(name: string, run: () => void) {
  run()
  passed++
  console.log('ok  ' + name)
}

const { en, es } = STRINGS

/** The shape of a value: which keys, how many items, how many arguments. Not the words themselves. */
function shape(v: unknown): unknown {
  if (typeof v === 'function') return `function of ${v.length}`
  if (Array.isArray(v)) return v.map(shape)
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, shape((v as Record<string, unknown>)[k])]))
  return typeof v
}

const ISSUES: Issue[] = [
  { kind: 'laps', seen: 0, asked: 4 },
  { kind: 'laps', seen: 1, asked: 4 },
  { kind: 'laps', seen: 2, asked: 4 },
  { kind: 'loops', seen: 0, asked: 4 },
  { kind: 'loops', seen: 1, asked: 4 },
  { kind: 'loops', seen: 2, asked: 4 },
  { kind: 'passes', seen: 0, asked: 4 },
  { kind: 'passes', seen: 1, asked: 4 },
  { kind: 'passes', seen: 2, asked: 4 },
  { kind: 'lifted', seen: 5 },
  { kind: 'part' },
  { kind: 'little' },
  { kind: 'joined', digits: false, lifted: false },
  { kind: 'joined', digits: true, lifted: false },
  { kind: 'joined', digits: false, lifted: true },
  { kind: 'joined', digits: true, lifted: true },
]

/** Every text that is built from numbers, with numbers a real result could have. */
function built(t: Strings): string[] {
  const m = metrics as unknown as Record<string, Record<string, Record<string, number>> & Record<string, number>>
  return [
    ...ISSUES.map((i) => t.check.text(i)),
    t.task.step(3, 5, t.tasks[5].title),
    t.task.noVoice('3 4 7'),
    t.result.score(42),
    t.result.realCase(3, 35, t.result.patient),
    t.result.noResult(1),
    t.result.noResult(2),
    t.result.redo(1),
    t.result.redo(2),
    t.check.redoing(t.tasks[5].title),
    t.lab.lifts(3),
    t.lab.pause(0.4),
    t.lab.share(21),
    t.lab.at(52),
    t.result.votesUnsure(44),
    t.result.votesDemo(20),
    t.note.line('14 November 2026', t.verdicts.typical.title, 18, true),
    t.note.detail(12, 22, 2, 2),
    t.note.noResult('14 November 2026', t.check.text(ISSUES[1])),
    t.why.missed(20, 22, 2, 2),
    t.why.falseAlarm(40, 22, 5, 2),
    t.history.many(3, 18),
    t.study.saved(2),
    t.study.copyAll(2),
    t.crowd.explain(85, 89),
    t.crowd.aria(18),
    t.honest.short(m['1.0'].model, m['1.0'].stopwatch, counts.train, counts.test),
    t.honest.closer(m.adaptive, counts.test),
    t.honest.told(m.told.patients, m.told.healthy),
    t.honest.device(m['1.5'].stopwatch, m['1.5'].model),
    t.honest.uneven(m.pauses2, m.screen2),
  ]
}

/** Every plain text in the object. */
function plain(v: unknown): string[] {
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.flatMap(plain)
  if (v && typeof v === 'object') return Object.values(v).flatMap(plain)
  return []
}

test('English and Spanish have exactly the same texts, lists and tasks', () => {
  assert.deepEqual(shape(es), shape(en))
})
test('no text is empty, and none shows a broken value', () => {
  for (const [lang, t] of Object.entries(STRINGS)) {
    for (const text of [...plain(t), ...built(t)]) {
      assert.ok(text.trim().length > 0, `${lang}: an empty text`)
      assert.ok(!/undefined|NaN|\[object|\bnull\b/.test(text), `${lang}: "${text.slice(0, 80)}"`)
    }
  }
})
test('there is a cheer for each of the eight tasks, and next steps for each answer', () => {
  for (const t of [en, es]) {
    assert.equal(t.task.cheers.length, 8)
    for (const kind of ['typical', 'unsure', 'mention'] as const) assert.ok(t.nextSteps[kind].length >= 2)
  }
})
test('every way a task can fall short has its own sentence, in both languages', () => {
  for (const t of [en, es]) assert.equal(new Set(ISSUES.map((i) => t.check.text(i))).size, ISSUES.length)
})
test('Spanish never calls the number a "nota" (a school mark, where higher is better); "nota" is only the note for the doctor', () => {
  for (const text of [...plain(es), ...built(es)]) {
    const rest = text.replace(/Nota para el médico|la nota de abajo/g, '')
    assert.ok(!/\bnota\b/i.test(rest), `"${text.slice(0, 90)}"`)
  }
})
test('the number is never presented as a percentage of risk', () => {
  for (const t of [en, es]) assert.ok(!/\d+ ?%/.test(t.result.score(42)), t.result.score(42))
})
test('buttons that sit side by side are short enough for a small phone', () => {
  for (const [lang, t] of Object.entries(STRINGS)) {
    const pairs = [t.task.startOver, t.task.done, t.check.keep, t.check.again, t.closer.stop, t.closer.more, t.guide.back, t.guide.next]
    for (const label of pairs) assert.ok(label.length <= 14, `${lang}: "${label}" is ${label.length} letters`)
  }
})

console.log(`\n${passed} checks of the texts passed.`)
