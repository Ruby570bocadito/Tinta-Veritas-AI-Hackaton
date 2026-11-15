// What Tinta shows on the sheet before each task: the task being done, so that nobody has to work it out from
// the words alone. People told us the instructions were not obvious. The numbers showed it too: one lap of the
// circle instead of four, the word written without lifting the finger.
//
// A demo is a list of steps on a timeline. A finger of light draws a faint line (finger down), or travels in
// orange dashes (finger in the air), the same colours the app uses afterwards for the invisible ink.
// Everything is in pixels of the sheet, so the dots and the circle fall exactly on the printed ones.
//
// Two rules keep the example honest:
//   - Tinta's own example must pass her own check of the task (tools/demo.test.ts).
//   - The example never gives the answer away. Writing a word backwards and naming an object are the thinking
//     part of those tasks, so their examples use another word: "sun", not the word on the screen.
import type { Stroke } from './ink'

export type Point = { x: number; y: number }
export type Size = { w: number; h: number }

export type Step =
  | { kind: 'stroke'; pts: Point[]; ms: number; count?: { n: number; at: Point; keep: boolean } } // finger down, drawing
  | { kind: 'letter'; ch: string; at: Point; size: number; ms: number } // finger down, writing one letter
  | { kind: 'lift'; to: Point; ms: number } // finger in the air, on its way to the next touch

export type Demo = {
  steps: Step[]
  // Something drawn from the start, to the left of the writing: the word that is being reversed, or a little
  // sun for "what is this?". Followed by an arrow.
  from?: { text?: string; sun?: boolean; at: Point; size: number; arrow: [Point, Point] }
}

/** What the example of each task needs to know: the word on the screen (only for the tasks that are copied) and the example word. */
export type Words = { prompt?: string; example: string }

const DOTS = 0.32 // the practice dots, as in InkCanvas.tsx
const RING = 37.8 * 1.5 // the printed circle is 3 cm across
const ease = (u: number) => (1 - Math.cos(Math.PI * u)) / 2

const line = (a: Point, b: Point, n = 24): Point[] =>
  Array.from({ length: n + 1 }, (_, i) => ({ x: a.x + (b.x - a.x) * ease(i / n), y: a.y + (b.y - a.y) * ease(i / n) }))

/** Four lines from dot to dot, there and back, in one go. */
function lines({ w, h }: Size, axis: 'x' | 'y'): Step[] {
  const a = axis === 'x' ? { x: w * (0.5 - DOTS), y: h / 2 } : { x: w / 2, y: h * (0.5 - DOTS) }
  const b = axis === 'x' ? { x: w * (0.5 + DOTS), y: h / 2 } : { x: w / 2, y: h * (0.5 + DOTS) }
  const at = axis === 'x' ? { x: w / 2, y: h / 2 - 0.13 * h } : { x: w / 2 + 0.16 * w, y: h / 2 }
  return [1, 2, 3, 4].map((n) => ({ kind: 'stroke', pts: n % 2 ? line(a, b) : line(b, a), ms: 620, count: { n, at, keep: false } }))
}

/** Four times round the printed circle, in one go. The count sits in the middle of it. */
function circle({ w, h }: Size): Step[] {
  const lap = (): Point[] =>
    Array.from({ length: 41 }, (_, i) => {
      const a = -Math.PI / 2 + (i / 40) * 2 * Math.PI
      return { x: w / 2 + RING * Math.cos(a), y: h / 2 + RING * Math.sin(a) }
    })
  return [1, 2, 3, 4].map((n) => ({ kind: 'stroke', pts: lap(), ms: 760, count: { n, at: { x: w / 2, y: h / 2 }, keep: false } }))
}

/** "le" four times in joined-up writing: a tall loop and a short one each, all in one go. */
function loops({ w, h }: Size): Step[] {
  const loop = (x0: number, tall: number, rx: number, adv: number, n = 22): Point[] =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = (i / n) * 2 * Math.PI
      return { x: w * (x0 + (adv * a) / (2 * Math.PI) - rx * Math.sin(a)), y: h * (0.6 - (tall * (1 - Math.cos(a))) / 2) }
    })
  return [1, 2, 3, 4].map((n) => {
    const x0 = 0.1 + (n - 1) * 0.21
    const pts = [...(n === 1 ? [{ x: w * (x0 - 0.03), y: h * 0.6 }] : []), ...loop(x0, 0.34, 0.03, 0.075), ...loop(x0 + 0.075, 0.15, 0.028, 0.065), { x: w * (x0 + 0.18), y: h * 0.6 }]
    return { kind: 'stroke', pts, ms: 780, count: { n, at: { x: w * (x0 + 0.07), y: h * 0.74 }, keep: true } }
  })
}

/** Letters written one at a time, the finger lifting after each one. */
function letters({ w, h }: Size, text: string, from: number, to: number): Step[] {
  const chars = [...text]
  const size = Math.min(0.3 * h, (0.9 * (to - from) * w) / Math.max(chars.length, 2) + 14)
  const at = (i: number): Point => ({ x: w * (chars.length === 1 ? (from + to) / 2 : from + ((to - from) * i) / (chars.length - 1)), y: h * 0.5 })
  const steps: Step[] = []
  chars.forEach((ch, i) => {
    steps.push({ kind: 'letter', ch, at: at(i), size, ms: 430 })
    if (i + 1 < chars.length) steps.push({ kind: 'lift', to: at(i + 1), ms: 430 })
  })
  return steps
}

/** The example for one task, on a sheet of this size. */
export function demoFor(task: number, sheet: Size, words: Words): Demo {
  const { w, h } = sheet
  if (task === 2) return { steps: lines(sheet, 'x') }
  if (task === 3) return { steps: lines(sheet, 'y') }
  if (task === 5) return { steps: circle(sheet) }
  if (task === 9) return { steps: loops(sheet) }
  const size = Math.min(0.2 * h, 0.11 * w)
  const arrow: [Point, Point] = [{ x: w * 0.36, y: h * 0.5 }, { x: w * 0.44, y: h * 0.5 }]
  // The word backwards: another word, so that the thinking is left to the person.
  if (task === 16) return { steps: letters(sheet, [...words.example].reverse().join(''), 0.56, 0.86), from: { text: words.example, at: { x: w * 0.2, y: h * 0.5 }, size, arrow } }
  // What is this? A little sun, and its name letter by letter.
  if (task === 18) return { steps: letters(sheet, words.example, 0.56, 0.86), from: { sun: true, at: { x: w * 0.22, y: h * 0.5 }, size, arrow } }
  // Letters and words to copy: the same ones that are on the screen.
  const copy = (words.prompt ?? '').replace(/\s+/g, '')
  return { steps: letters(sheet, copy, copy.length > 3 ? 0.16 : 0.24, copy.length > 3 ? 0.84 : 0.76) }
}

/** How long the example takes, in milliseconds. */
export const duration = (demo: Demo) => demo.steps.reduce((sum, s) => sum + s.ms, 0)

/**
 * The strokes of an example as the app would record them if a person wrote it: used to check that what Tinta
 * shows is something Tinta accepts. Only for the examples that are drawn (letters are shown as letters).
 */
export function asStrokes(demo: Demo): Stroke[] {
  const strokes: Stroke[] = []
  let t = 0
  let joined = false
  for (const s of demo.steps) {
    if (s.kind === 'stroke') {
      const pts = s.pts.map((p, i) => ({ x: p.x, y: p.y, t: t + (s.ms * i) / (s.pts.length - 1) }))
      if (joined) strokes[strokes.length - 1].push(...pts)
      else strokes.push(pts)
      joined = true
    } else {
      joined = false
    }
    t += s.ms
  }
  return strokes
}
