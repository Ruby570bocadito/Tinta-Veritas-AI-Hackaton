// The model runs here, in the browser. Nothing leaves the phone.
// Weights come from ml/train_export.py (logistic regression on DARWIN).
import data from '../model.json'
import type { Measures } from './ink'

export const TASK_IDS: number[] = data.tasks
export const MEASURE_NAMES = data.measures as (keyof Measures)[]
export const metrics = data.metrics
export const examples = data.examples

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

/** Probability that the pattern looks like the patient group in DARWIN. */
export function predict(byTask: Record<number, Measures>): number {
  let z = data.intercept
  let i = 0
  for (const task of TASK_IDS) {
    for (const name of MEASURE_NAMES) {
      const x = Math.log1p(byTask[task][name])
      z += data.coef[i] * ((x - data.mean[i]) / data.std[i])
      i++
    }
  }
  return sigmoid(z)
}

/** The simple rule we compare against: total time only. */
export function baseline(byTask: Record<number, Measures>): number {
  const total = TASK_IDS.reduce((sum, t) => sum + byTask[t].total_time, 0)
  const b = data.baseline
  return sigmoid(b.intercept + b.coef * ((Math.log(total) - b.mean) / b.std))
}

export type Verdict = 'typical' | 'unsure' | 'mention'

// The grey zone is on purpose: when the model is not sure, Tinta says so.
export function verdict(p: number): Verdict {
  if (p < 0.35) return 'typical'
  if (p > 0.65) return 'mention'
  return 'unsure'
}
