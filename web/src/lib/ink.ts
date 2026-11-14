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

// A finger sliding on glass sometimes loses contact for an instant. A break shorter than this is a skip, not a
// lift: the two pieces are one stroke. A pen on the study's tablet does not skip like that, and without this
// four skips in a circle were enough to turn "usual pattern" into "worth mentioning".
export const SKIP_MS = 150

/** The strokes as the person meant them: pieces less than a skip apart are joined into one. */
export function joinSkips(strokes: Stroke[]): Stroke[] {
  const out: Stroke[] = []
  for (const s of strokes) {
    if (s.length === 0) continue
    const last = out[out.length - 1]
    if (last && s[0].t - last[last.length - 1].t < SKIP_MS) out[out.length - 1] = [...last, ...s]
    else out.push(s)
  }
  return out
}

/** The pauses with the finger in the air, one per lift (skips are not lifts). */
export function gaps(strokes: Stroke[]): Gap[] {
  const done = joinSkips(strokes)
  const out: Gap[] = []
  for (let i = 1; i < done.length; i++) {
    const from = done[i - 1][done[i - 1].length - 1]
    const to = done[i][0]
    out.push({ from, to, ms: to.t - from.t })
  }
  return out
}

export function measure(strokes: Stroke[]): Measures {
  const done = joinSkips(strokes)
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

export const seconds = (ms: number, lang = 'en') => (ms / 1000).toFixed(1).replace('.', lang === 'es' ? ',' : '.') + '\u00a0s'
