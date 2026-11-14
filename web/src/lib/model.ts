// The model runs here, in the browser. Nothing leaves the phone.
// Weights come from ml/train_export.py (logistic regression trained on DARWIN).
//
// Every measure is relative to the person's own speed on two warm-up tasks,
// so a device that is slower or faster overall does not change the score.
import data from '../model.json'
import type { Measures } from './ink'

export const WARMUP_IDS: number[] = data.warmup
export const TASK_IDS: number[] = data.tasks
export const metrics = data.metrics
export const examples = data.examples
export const counts = { train: data.train_n, test: data.test_n }

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

/** How much slower each task is than the person's own warm-up pace (1 = same pace). */
export function slowdown(byTask: Record<number, Measures>, task: number): number {
  const ref = WARMUP_IDS.reduce((s, t) => s + Math.log(byTask[t].total_time), 0) / WARMUP_IDS.length
  return Math.exp(Math.log(byTask[task].total_time) - ref)
}

/** Probability that the pattern looks like the patient group in DARWIN. */
export function predict(byTask: Record<number, Measures>): number {
  let z = data.intercept
  let i = 0
  for (const task of TASK_IDS) {
    const m = byTask[task]
    const x = [Math.log(slowdown(byTask, task)), m.air_time / Math.max(m.total_time, 1), Math.log1p(m.num_of_pendown)]
    for (const v of x) {
      z += data.coef[i] * ((v - data.mean[i]) / data.std[i])
      i++
    }
  }
  return sigmoid(z)
}

export type Verdict = 'typical' | 'unsure' | 'mention'

// The grey zone is on purpose: when the model is not sure, Tinta says so.
export function verdict(p: number): Verdict {
  if (p < 0.35) return 'typical'
  if (p > 0.65) return 'mention'
  return 'unsure'
}
