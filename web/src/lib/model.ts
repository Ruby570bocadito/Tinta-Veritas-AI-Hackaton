// The models run here, in the browser. Nothing leaves the phone.
// Weights come from ml/train_export.py (trained on the DARWIN dataset).
//
// Every measure is relative to the person's own speed on two warm-up tasks,
// so a device that is slower or faster overall does not change the score.
//
// Stage 1: three scored tasks, logistic regression.
// Stage 2: only when stage 1 is unsure. Three more tasks, and the average of three models
//          (logistic regression, RBF support vector machine, random forest) on all six.
import data from '../model.json'
import type { Measures } from './ink'

export const WARMUP_IDS: number[] = data.warmup
export const TASK_IDS: number[] = data.tasks
export const EXTRA_IDS: number[] = data.extra_tasks
export const [GREY_LO, GREY_HI] = data.grey
export const metrics = data.metrics
export const examples = data.examples
export const counts = { train: data.train_n, test: data.test_n }
export const reference = { healthyWarmupMs: data.healthy_warmup_ms }

type ByTask = Record<number, Measures>
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

/** How much slower each task is than the person's own warm-up pace (1 = same pace). */
export function slowdown(byTask: ByTask, task: number): number {
  const ref = WARMUP_IDS.reduce((s, t) => s + Math.log(byTask[t].total_time), 0) / WARMUP_IDS.length
  return Math.exp(Math.log(byTask[task].total_time) - ref)
}

/** Three numbers per task: slowdown, share of time in the air, touches. */
function features(byTask: ByTask, tasks: number[]): number[] {
  return tasks.flatMap((task) => {
    const m = byTask[task]
    return [Math.log(slowdown(byTask, task)), m.air_time / Math.max(m.total_time, 1), Math.log1p(m.num_of_pendown)]
  })
}

const scale = (x: number[], mean: number[], std: number[]) => x.map((v, i) => (v - mean[i]) / std[i])
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0)

/** Stage 1. Probability that the pattern looks like the patient group in DARWIN. */
export function predict(byTask: ByTask): number {
  return sigmoid(data.intercept + dot(scale(features(byTask, TASK_IDS), data.mean, data.std), data.coef))
}

function logistic(x: number[]): number {
  const m = data.blend.logistic
  return sigmoid(m.intercept + dot(scale(x, m.mean, m.std), m.coef))
}

function svm(x: number[]): number {
  const m = data.blend.svm
  const z = scale(x, m.mean, m.std)
  let score = m.intercept
  m.vectors.forEach((v: number[], i: number) => {
    const d2 = v.reduce((s, vj, j) => s + (z[j] - vj) ** 2, 0)
    score += m.weights[i] * Math.exp(-m.gamma * d2)
  })
  return sigmoid(m.a * score + m.b) // the score is turned into a probability by a fitted sigmoid
}

function forest(x: number[]): number {
  const m = data.blend.forest
  const z = scale(x, m.mean, m.std)
  let sum = 0
  for (const tree of m.trees) {
    let node = 0
    while (tree.l[node] !== -1) node = z[tree.f[node]] <= tree.t[node] ? tree.l[node] : tree.r[node]
    sum += tree.p[node]
  }
  return sum / m.trees.length
}

/** Stage 2. Three different models look at all six tasks and their answers are averaged. */
export function predictCloser(byTask: ByTask): { p: number; votes: { name: string; p: number }[] } {
  const x = features(byTask, [...TASK_IDS, ...EXTRA_IDS])
  const votes = [
    { name: 'Straight-line model', p: logistic(x) },
    { name: 'Nearest-pattern model', p: svm(x) },
    { name: 'Forest of small trees', p: forest(x) },
  ]
  return { p: votes.reduce((s, v) => s + v.p, 0) / votes.length, votes }
}

export const isGrey = (p: number) => p > GREY_LO && p < GREY_HI

export type Verdict = 'typical' | 'unsure' | 'mention'

// The grey zone is on purpose: when the model is not sure, Tinta says so.
export function verdict(p: number): Verdict {
  if (p <= GREY_LO) return 'typical'
  if (p >= GREY_HI) return 'mention'
  return 'unsure'
}
