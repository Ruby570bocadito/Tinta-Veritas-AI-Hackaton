// What Tinta records while someone writes, and the measures computed from it.
// The four measures match the DARWIN dataset columns the model was trained on.

export type Point = { x: number; y: number; t: number }
export type Stroke = Point[]

export type Measures = {
  air_time: number // ms with the finger off the screen, between strokes
  paper_time: number // ms with the finger on the screen
  total_time: number // ms from first touch to last lift
  num_of_pendown: number // how many times the finger touched down
}

export type Gap = { from: Point; to: Point; ms: number }

export function gaps(strokes: Stroke[]): Gap[] {
  const out: Gap[] = []
  for (let i = 1; i < strokes.length; i++) {
    const from = strokes[i - 1][strokes[i - 1].length - 1]
    const to = strokes[i][0]
    out.push({ from, to, ms: to.t - from.t })
  }
  return out
}

export function measure(strokes: Stroke[]): Measures {
  const done = strokes.filter((s) => s.length > 0)
  if (done.length === 0) return { air_time: 0, paper_time: 0, total_time: 0, num_of_pendown: 0 }
  const paper = done.reduce((sum, s) => sum + (s[s.length - 1].t - s[0].t), 0)
  const air = gaps(done).reduce((sum, g) => sum + g.ms, 0)
  const last = done[done.length - 1]
  return {
    air_time: air,
    paper_time: paper,
    total_time: last[last.length - 1].t - done[0][0].t,
    num_of_pendown: done.length,
  }
}

/**
 * Milliseconds the finger rested on the screen without moving (stops of a quarter of a second or more).
 * The model does not use it. It is saved in study mode, because on glass a pause may be a finger that
 * stops rather than one that lifts, and a phone can only see the second kind as time in the air.
 */
export function stillTime(strokes: Stroke[], least = 250): number {
  let sum = 0
  for (const s of strokes) for (let i = 1; i < s.length; i++) if (s[i].t - s[i - 1].t >= least) sum += s[i].t - s[i - 1].t
  return Math.round(sum)
}

export const seconds = (ms: number) => (ms / 1000).toFixed(1) + ' s'
