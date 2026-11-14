// Can this task be compared with the study? Plain geometry, no machine learning.
//
// Everyone in the study the model learned from did the tasks: four times round the circle, the whole
// word, and so on. The model compares pauses and lifts, so its answer only means something when the task
// was really done. These checks catch the clear cases: one lap instead of four, half a word, a tap.
//
// One check is about phones, not about the person. A pen tablet also sees the pen hovering before and
// after each stroke, so in the study everybody had some time in the air: on the backwards word, never
// under 12.5% of the task. A phone cannot see a finger in the air, so a word written in a single drag,
// or with one quick lift, has less than anyone in the study: a value the model has never seen. Then there
// is nothing to compare, and Tinta says so. (The limits come from the data: AIR_FLOOR in model.ts.)
//
// The checks are loose on purpose (a task counts from about two and a half of its four repetitions), so
// that nobody who did the task is told off. They cannot read handwriting: someone who scribbles for long
// enough, lifting now and then, still gets a score. tools/personas.test.ts shows what is caught.
import { measure, type Stroke } from './ink'
import { AIR_FLOOR } from './model'

export type Sheet = { w: number; h: number }

export type Issue =
  | { kind: 'laps'; seen: number; asked: number } // the circle: went round fewer times than asked
  | { kind: 'loops'; seen: number; asked: number } // "le" four times: fewer of them than asked
  | { kind: 'passes'; seen: number; asked: number } // the practice lines: fewer lines between the dots than asked
  | { kind: 'lifted'; seen: number } // practice only: lifted the finger many times in a task meant to be done in one go
  | { kind: 'part' } // a word or a number: it looks like only part of it is there
  | { kind: 'little' } // hardly anything was written: a tap, a dot, a dash
  | { kind: 'joined'; digits: boolean; lifted: boolean } // a word or a number with less pause than anyone in the study: nothing to time

const ASKED = 4 // the study asks for four lines, four circles and four "le"
const ENOUGH = ASKED - 1.5 // from two and a half of the four, the task counts as done
const DOTS = 0.32 // the practice dots sit this far from the middle of the sheet, as a share of its size
// Words and numbers: the fewest changes of direction that still look like the whole thing.
// (Made-up writing of the whole task gives about twice these numbers; see tools/personas.test.ts.)
const FEWEST_TURNS: Record<number, number> = { 16: 10, 15: 10, 6: 6, 18: 6, 22: 16, 23: 16 }

function box(strokes: Stroke[]) {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const s of strokes)
    for (const p of s) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    }
  return { minX, maxX, minY, maxY }
}

/** How many times the writing goes round its own middle. Four full circles give 4. */
export function laps(strokes: Stroke[]): number {
  const { minX, maxX, minY, maxY } = box(strokes)
  if (minX === Infinity) return 0
  // Measured around the middle of the drawing, not of the sheet: a circle drawn beside the printed one still counts.
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  // Right next to the middle the angle jumps about with any tiny move (a tap there would count as half a lap).
  const tooClose = 0.3 * Math.max(maxX - minX, maxY - minY) * 0.5
  let total = 0
  for (const s of strokes) {
    let turned = 0
    for (let i = 1; i < s.length; i++) {
      if (Math.hypot(s[i].x - cx, s[i].y - cy) < tooClose || Math.hypot(s[i - 1].x - cx, s[i - 1].y - cy) < tooClose) continue
      let d = Math.atan2(s[i].y - cy, s[i].x - cx) - Math.atan2(s[i - 1].y - cy, s[i - 1].x - cx)
      if (d > Math.PI) d -= 2 * Math.PI
      if (d < -Math.PI) d += 2 * Math.PI
      turned += d
    }
    total += Math.abs(turned) // each stroke counts, so lifting the finger half way round loses nothing
  }
  return total / (2 * Math.PI)
}

/** How many lines were drawn from one practice dot to the other. */
export function passes(strokes: Stroke[], sheet: Sheet, axis: 'x' | 'y'): number {
  const size = axis === 'x' ? sheet.w : sheet.h
  const near = (v: number) => (v < size * (0.5 - DOTS / 2) ? 'a' : v > size * (0.5 + DOTS / 2) ? 'b' : null)
  let at: 'a' | 'b' | null = null
  let count = 0
  for (const s of strokes) {
    s.forEach((p, i) => {
      const zone = near(p[axis])
      if (!zone || zone === at) return
      // Landing next to the other dot after a lift is a jump through the air, not a line.
      if (at && i > 0) count++
      at = zone
    })
  }
  return count
}

/**
 * How many times the writing changes direction along one axis ('x': sideways, 'y': up and down).
 * The strokes are read as one long line, so lifting the finger often (the very thing the model looks for)
 * never makes the writing look smaller than it is.
 */
export function reversals(strokes: Stroke[], sheet: Sheet, axis: 'x' | 'y'): number {
  const points = strokes.flat()
  if (!points.length) return 0
  // Smaller wobbles than this are a shaky finger, not a turn. Small writing gets a smaller limit, so that
  // someone who writes small is not told that half the word is missing.
  const { minX, maxX, minY, maxY } = box(strokes)
  const least = Math.max(2, Math.min(0.03 * Math.min(sheet.w, sheet.h), 0.06 * Math.max(maxX - minX, maxY - minY)))
  let count = 0
  let anchor = points[0][axis]
  let dir = 0
  for (const p of points) {
    const v = p[axis]
    if (dir === 0) {
      if (Math.abs(v - anchor) >= least) {
        dir = Math.sign(v - anchor)
        anchor = v
      }
    } else if ((v - anchor) * dir > 0) {
      anchor = v // still going the same way
    } else if (Math.abs(v - anchor) >= least) {
      count++
      dir = -dir
      anchor = v
    }
  }
  return count
}

/** Changes of direction, sideways plus up and down: a rough "how much was written". */
export const turns = (strokes: Stroke[], sheet: Sheet) => reversals(strokes, sheet, 'x') + reversals(strokes, sheet, 'y')

/** How many "le" there are, counted from the ups and downs: each "le" is two loops, so four changes of direction. */
export const les = (strokes: Stroke[], sheet: Sheet) => (reversals(strokes, sheet, 'y') + 1) / 4

/** How far the finger travelled on the screen, in pixels. Taps travel nowhere. */
export function travelled(strokes: Stroke[]): number {
  let sum = 0
  for (const s of strokes) for (let i = 1; i < s.length; i++) sum += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y)
  return sum
}

/** Why this task cannot be compared with the study, or null when it can. */
export function check(task: number, strokes: Stroke[], sheet: Sheet): Issue | null {
  const done = strokes.filter((s) => s.length > 0)
  // A finger that hardly moved (taps, dots) wrote nothing, whatever the task.
  if (travelled(done) < 0.2 * Math.min(sheet.w, sheet.h)) return { kind: 'little' }
  if (task === 2 || task === 3) {
    const seen = passes(done, sheet, task === 2 ? 'x' : 'y')
    if (seen < ENOUGH) return { kind: 'passes', seen, asked: ASKED }
    // In the study even healthy people often lifted once or twice here, so only say it when it is clearly not "in one go".
    const lifts = measure(done).num_of_pendown - 1 // skips of the finger are not lifts
    return lifts >= 3 ? { kind: 'lifted', seen: lifts } : null
  }
  if (task === 5) {
    const seen = laps(done)
    return seen < ENOUGH ? { kind: 'laps', seen: Math.round(seen), asked: ASKED } : null
  }
  if (task === 9) {
    const seen = les(done, sheet)
    return seen < ENOUGH ? { kind: 'loops', seen: Math.round(seen), asked: ASKED } : null
  }
  const fewest = FEWEST_TURNS[task]
  if (fewest === undefined) return null
  if (turns(done, sheet) < fewest) return { kind: 'part' }
  // Less time in the air than anyone in the study had on this task: written in a single drag, or nearly.
  // On a phone that leaves too little pause to time (see the top of this file).
  const m = measure(done)
  const floor = AIR_FLOOR[task]
  if (floor === undefined || m.air_time / Math.max(m.total_time, 1) >= floor) return null
  return { kind: 'joined', digits: task === 22 || task === 23, lifted: m.num_of_pendown > 1 }
}
