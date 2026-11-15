// Made-up "people" for the tests: the shapes the tasks ask for, and ways of doing them wrong.
//
// Everything is in sheet coordinates from 0 to 1. The same shapes are used by the tests that need no
// browser (people.ts) and by the scripts that write on the real app with pointer events (screens.mjs).
// These are drawings made by a formula. They are useful for finding holes, and they are not people.

export const SHEET = { w: 358, h: 354 } // a typical phone sheet, in CSS pixels
const RING = { x: 56.7 / SHEET.w, y: 56.7 / SHEET.h } // the printed circle is 3 cm across
const DOTS = 0.32 // the practice dots, as in InkCanvas.tsx

const ease = (u) => (1 - Math.cos(Math.PI * u)) / 2
const between = (a, b, n = 30) => Array.from({ length: n + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * ease(i / n), a[1] + (b[1] - a[1]) * ease(i / n)])

/** Lines between the two practice dots: `passes` of them, in one go. */
export function lines(axis, passes) {
  const a = axis === 'x' ? [0.5 - DOTS, 0.5] : [0.5, 0.5 - DOTS]
  const b = axis === 'x' ? [0.5 + DOTS, 0.5] : [0.5, 0.5 + DOTS]
  const whole = Math.floor(passes)
  const path = []
  for (let i = 0; i < whole; i++) path.push(...(i % 2 ? between(b, a) : between(a, b)))
  const rest = passes - whole
  if (rest > 0.02) {
    const [from, to] = whole % 2 ? [b, a] : [a, b]
    path.push(...between(from, [from[0] + (to[0] - from[0]) * rest, from[1] + (to[1] - from[1]) * rest]))
  }
  return [path]
}

/** Round the printed circle `laps` times, in one go. */
export function circle(laps) {
  const n = Math.max(2, Math.round(40 * laps))
  return [Array.from({ length: n + 1 }, (_, i) => {
    const a = -Math.PI / 2 + (i / n) * laps * 2 * Math.PI
    return [0.5 + RING.x * Math.cos(a), 0.5 + RING.y * Math.sin(a)]
  })]
}

const loop = (x0, h, rx, adv, n = 22) => Array.from({ length: n + 1 }, (_, i) => {
  const a = (i / n) * 2 * Math.PI
  return [x0 + (adv * a) / (2 * Math.PI) - rx * Math.sin(a), 0.64 - (h * (1 - Math.cos(a))) / 2]
})

/** "le" in joined-up writing, `count` times: a tall loop and a short one each. One path per "le". */
export function loops(count) {
  const out = []
  for (let i = 0; i < Math.ceil(count - 0.02); i++) {
    const x0 = 0.1 + i * 0.21
    const le = [[x0 - 0.03, 0.64], ...loop(x0, 0.34, 0.03, 0.075), ...loop(x0 + 0.075, 0.15, 0.028, 0.065), [x0 + 0.17, 0.63]]
    out.push(i + 1 > count ? le.slice(0, Math.max(2, Math.round(le.length * (count - i)))) : le)
  }
  return out
}

// Letter-like shapes: a bowl, a hump, a tail. Not real letters, but with the turns real letters have.
const LETTERS = [
  (x) => Array.from({ length: 19 }, (_, i) => { const a = 0.6 + (i / 18) * 5.4; return [x + 0.035 + 0.035 * Math.cos(a), 0.52 + 0.06 * Math.sin(a)] }),
  (x) => [...between([x, 0.4], [x, 0.58], 8), ...Array.from({ length: 13 }, (_, i) => [x + 0.06 * (i / 12), 0.52 - 0.05 * Math.sin((i / 12) * Math.PI)]), ...between([x + 0.06, 0.52], [x + 0.06, 0.58], 5)],
  (x) => Array.from({ length: 21 }, (_, i) => [x + 0.03 + 0.03 * Math.sin((i / 20) * 2 * Math.PI) * (i < 10 ? 1 : -1), 0.46 + 0.12 * (i / 20)]),
]

/** Something like a word of `letters` letters, one path per letter. */
export function word(letters, from = 0.14, step = 0.15) {
  return Array.from({ length: Math.max(0, Math.round(letters)) }, (_, i) => LETTERS[i % LETTERS.length](from + i * step))
}

/** A zigzag across the sheet. */
export function scribble(turns = 9) {
  const path = []
  for (let i = 0; i < turns; i++) path.push(...between([0.12 + (0.76 * i) / turns, i % 2 ? 0.66 : 0.34], [0.12 + (0.76 * (i + 1)) / turns, i % 2 ? 0.34 : 0.66], 10))
  return [path]
}

/** `n` taps, each a dot. */
export const taps = (n = 3) => Array.from({ length: n }, (_, i) => [[0.3 + 0.2 * (i % 3), 0.5], [0.302 + 0.2 * (i % 3), 0.501]])

/** One short dash. */
export const dash = () => [between([0.4, 0.5], [0.6, 0.5], 10)]

// How each task is done when it is done as asked: the shape, the seconds with the finger down, the pause at each lift.
const ASKED = {
  2: { shape: (amount) => lines('x', 4 * amount), seconds: 6, pause: 0.4 },
  3: { shape: (amount) => lines('y', 4 * amount), seconds: 5, pause: 0.4 },
  5: { shape: (amount) => circle(4 * amount), seconds: 9, pause: 0.4 },
  9: { shape: (amount) => loops(4 * amount), seconds: 5, pause: 0.5, joined: true },
  16: { shape: (amount) => word(5 * amount), seconds: 3.5, pause: 0.45 },
  // The closer look: three letters, a word to copy, the name of an object.
  6: { shape: (amount) => word(3 * amount, 0.2, 0.25), seconds: 2.5, pause: 0.5 },
  10: { shape: (amount) => word(5 * amount), seconds: 3, pause: 0.4 },
  18: { shape: (amount) => word(5 * amount), seconds: 3, pause: 0.45 },
}
export const TASK_NUMBERS = Object.keys(ASKED).map(Number)

const place = (paths, where) => {
  const move = { corner: (p) => [0.16 + p[0] * 0.5, 0.14 + p[1] * 0.5], tiny: (p) => [0.5 + (p[0] - 0.5) * 0.3, 0.5 + (p[1] - 0.5) * 0.3], big: (p) => [0.5 + (p[0] - 0.5) * 1.4, 0.5 + (p[1] - 0.5) * 1.4] }[where]
  return move ? paths.map((path) => path.map((p) => move(p).map((v) => Math.min(0.98, Math.max(0.02, v))))) : paths
}

/**
 * One task, done in a given way. Returns the strokes to write: [{ pts, ms, gap }], gap = pause in the air afterwards.
 *
 *   do       'asked' (default) | 'scribble' | 'taps' | 'dash'
 *   amount   how much of the task was done: 1 = all of it, 0.25 = one lap of four, 1.5 = six laps
 *   lifts    how many times the finger lifts. Default: what comes naturally (none for lines, circle and loops;
 *            between letters for words and numbers)
 *   pause    seconds in the air at each lift
 *   seconds  seconds with the finger on the screen, for the whole task
 *   where    'guide' (default) | 'corner' | 'tiny' | 'big'
 *   shaky    true for a trembling hand
 */
export function perform(task, how = {}) {
  const asked = ASKED[task]
  if (!asked) throw new Error(`no task ${task}; the tasks are ${TASK_NUMBERS.join(', ')}`)
  const kind = how.do ?? 'asked'
  const amount = how.amount ?? 1
  let paths = kind === 'scribble' ? scribble(Math.max(1, Math.round(9 * amount))) : kind === 'taps' ? taps(how.n ?? 3) : kind === 'dash' ? dash() : asked.shape(amount)
  if (kind === 'asked' && asked.joined && how.lifts === undefined) paths = [paths.flat()] // joined-up writing: one stroke
  paths = paths.filter((path) => path.length > 0)
  if (how.lifts !== undefined && kind !== 'taps') {
    // Cut the whole drawing into lifts + 1 strokes of the same length.
    const all = paths.flat()
    const pieces = Math.min(how.lifts + 1, Math.max(1, Math.floor(all.length / 2)))
    paths = Array.from({ length: pieces }, (_, i) => all.slice(Math.floor((i * all.length) / pieces), Math.floor(((i + 1) * all.length) / pieces) + (i + 1 < pieces ? 1 : 0)))
  }
  paths = place(paths, how.where)
  if (how.shaky) {
    let seed = 7
    const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.024
    paths = paths.map((path) => path.map((p) => [p[0] + noise(), p[1] + noise()]))
  }
  const points = paths.reduce((sum, path) => sum + path.length, 0)
  const seconds = how.seconds ?? (kind === 'asked' ? asked.seconds * Math.max(amount, 0.1) : kind === 'taps' ? 0.1 * paths.length : 2)
  const pause = how.pause ?? asked.pause
  return paths.map((pts, i) => ({ pts, ms: Math.max(20, (1000 * seconds * pts.length) / points), gap: i + 1 < paths.length ? 1000 * pause : 0 }))
}

/** The strokes as the app records them: pixels on the sheet and milliseconds. */
export function toStrokes(plan, sheet = SHEET, start = 0) {
  let t = start
  return plan.map(({ pts, ms, gap }) => {
    const stroke = pts.map((p, i) => ({ x: p[0] * sheet.w, y: p[1] * sheet.h, t: t + (ms * i) / Math.max(1, pts.length - 1) }))
    t += ms + gap
    return stroke
  })
}
