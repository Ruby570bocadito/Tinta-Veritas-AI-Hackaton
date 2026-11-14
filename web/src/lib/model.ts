// The models run here, in the browser. Nothing leaves the phone.
// Weights come from ml/train_export.py (trained on the DARWIN dataset).
//
// Two measures per task: the share of the task spent with the finger in the air, and the number
// of touches. Neither depends on how fast the person or the device is overall.
// (ml/ablation.py shows these two carry the signal, and what happens when a device changes
// pauses and strokes by different amounts.)
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
export const SPLIT: number = data.split
export const metrics = data.metrics
export const examples = data.examples
// Short-check score of every person in the study, from a model that had not seen them (for the dot chart).
export const crowd: { healthy: number[]; patients: number[] } = data.crowd
// The lowest share of time in the air that anyone in the study had, for the tasks where lifting comes naturally.
export const AIR_FLOOR: Record<number, number> = data.air_floor
export const counts = { train: data.train_n, test: data.test_n }
// Typical values among the healthy people the model learned from.
export const typical = { air: data.healthy_air, touches: data.healthy_touches }

type ByTask = Record<number, Measures>
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z))

/** Share of a task spent with the finger off the screen (0 to 1). */
export const airShare = (m: Measures) => m.air_time / Math.max(m.total_time, 1)

/** Two numbers per task: share of time in the air, and touches. */
function features(byTask: ByTask, tasks: number[]): number[] {
  return tasks.flatMap((task) => [airShare(byTask[task]), Math.log1p(byTask[task].num_of_pendown)])
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
export function predictCloser(byTask: ByTask): { p: number; votes: { name: string; p: number }[]; split: boolean } {
  const x = features(byTask, [...TASK_IDS, ...EXTRA_IDS])
  const votes = [
    { name: 'Straight-line model', p: logistic(x) },
    { name: 'Nearest-pattern model', p: svm(x) },
    { name: 'Forest of small trees', p: forest(x) },
  ]
  const ps = votes.map((v) => v.p)
  // When the three models pull far apart, the honest answer is "I can't tell".
  const split = Math.max(...ps) - Math.min(...ps) > SPLIT
  return { p: ps.reduce((s, v) => s + v, 0) / ps.length, votes, split }
}

export const isGrey = (p: number) => p > GREY_LO && p < GREY_HI

/**
 * The number shown to people, from 0 to 100. It is rounded so that it never contradicts the answer:
 * "usual pattern" is always 35 or under, "worth mentioning" always 65 or over, "I can't tell" always in between.
 * (Plain rounding would show 65 both for 0.646, which is "I can't tell", and for 0.654, which is "worth mentioning".)
 */
export function onScale(p: number): number {
  const n = Math.round(p * 100)
  const lo = Math.round(GREY_LO * 100)
  const hi = Math.round(GREY_HI * 100)
  if (p <= GREY_LO) return Math.min(n, lo)
  if (p >= GREY_HI) return Math.max(n, hi)
  return Math.min(hi - 1, Math.max(lo + 1, n))
}

export type Verdict = 'typical' | 'unsure' | 'mention'

// The grey zone is on purpose: when the model is not sure, Tinta says so.
export function verdict(p: number): Verdict {
  if (p <= GREY_LO) return 'typical'
  if (p >= GREY_HI) return 'mention'
  return 'unsure'
}
