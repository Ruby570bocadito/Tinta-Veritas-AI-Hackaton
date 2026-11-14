// What Tinta answers, from what was written. No screen code here, so the tests and the app use the very same logic.
import { check, type Issue, type Sheet } from './check'
import { measure, type Measures, type Stroke } from './ink'
import { EXTRA_IDS, TASK_IDS, WARMUP_IDS, isGrey, predict, predictCloser, verdict, type Verdict } from './model'

export type Scored = {
  byTask: Record<number, Measures>
  first: number // the short check, 0 to 1
  second: ReturnType<typeof predictCloser> | null // the closer look, when it was needed and done
  p: number // the score that counts
  kind: Verdict
}

export type Answer = Scored & {
  /**
   * Scored tasks that cannot be compared with the study: not done as asked, or written with no pause to time.
   * With any of these Tinta gives no result, whatever the models say.
   */
  noResult: { id: number; issue: Issue }[]
}

/** The models' answer to a set of measures. `hasExtra`: the three extra tasks were done. `force`: demo mode. */
export function score(byTask: Record<number, Measures>, hasExtra: boolean, force = false): Scored {
  const first = predict(byTask)
  const second = (isGrey(first) || force) && hasExtra ? predictCloser(byTask) : null
  const p = second ? second.p : first
  return { byTask, first, second, p, kind: second?.split ? 'unsure' : verdict(p) }
}

const NO_SHEET: Sheet = { w: 360, h: 340 }

/** The answer to someone's own writing: first "can each task be compared?", then the models. */
export function judge(ink: Record<number, Stroke[]>, sheets: Record<number, Sheet>, closer: boolean, force = false): Answer {
  const byTask: Record<number, Measures> = {}
  for (const id of [...WARMUP_IDS, ...TASK_IDS, ...EXTRA_IDS]) byTask[id] = measure(ink[id] ?? [])
  const hasExtra = closer && EXTRA_IDS.every((id) => (ink[id] ?? []).length > 0)
  const scored = score(byTask, hasExtra, force)
  const used = scored.second ? [...TASK_IDS, ...EXTRA_IDS] : TASK_IDS
  const noResult = used.flatMap((id) => {
    const issue = check(id, ink[id] ?? [], sheets[id] ?? NO_SHEET)
    return issue ? [{ id, issue }] : []
  })
  return { ...scored, kind: noResult.length ? 'unsure' : scored.kind, noResult }
}

/** After the short check: is a closer look worth asking for? Not when a task cannot be compared. */
export function wantsCloser(ink: Record<number, Stroke[]>, sheets: Record<number, Sheet>, force = false): boolean {
  const a = judge(ink, sheets, false)
  return a.noResult.length === 0 && (force || isGrey(a.first))
}
