import { useEffect, useRef } from 'react'
import { demoFor, duration, type Demo as Plan, type Point, type Step } from '../lib/demo'

// The example Tinta draws on the empty sheet before each task (see lib/demo.ts for what it shows and why).
// It plays again and again until the person touches the sheet. With "reduce motion" on, the finished
// example is shown still.

type Props = { task: number; prompt?: string; example: string; tag: string }

const GHOST = 'rgba(128, 111, 74, 0.62)' // the brown of the printed guides: clearly not the person's own ink
const NUMBER = 'rgba(96, 80, 46, 0.9)'
const AIR = '#e8622a' // the finger, and its way through the air: the colour of the invisible ink
const WAIT = 500 // the screen lands first
const REST = 1700 // the finished example stays this long, then starts again
const FADE = 350

const hand = (size: number) => `${Math.round(size)}px "Patrick Hand", "Comic Sans MS", cursive`
const ease = (u: number) => (1 - Math.cos(Math.PI * u)) / 2
/** Where the finger starts and ends a letter: across it, from the top left to the bottom right. */
const across = (s: Extract<Step, { kind: 'letter' }>, u: number): Point => ({ x: s.at.x + s.size * (-0.16 + 0.32 * u), y: s.at.y + s.size * (-0.26 + 0.5 * u) })

function paint(canvas: HTMLCanvasElement, plan: Plan, at: number, alpha: number) {
  const ctx = canvas.getContext('2d')!
  const ratio = window.devicePixelRatio || 1
  const { width, height } = canvas.getBoundingClientRect()
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const small = Math.min(width, height)

  // What the writing starts from: the example word, or a little sun, and an arrow.
  const from = plan.from
  if (from) {
    ctx.globalAlpha = alpha
    ctx.strokeStyle = NUMBER
    ctx.fillStyle = NUMBER
    ctx.lineWidth = 2.5
    if (from.text) {
      ctx.font = hand(from.size)
      ctx.fillText(from.text, from.at.x, from.at.y)
    }
    if (from.sun) {
      const r = from.size * 0.3
      ctx.beginPath()
      ctx.arc(from.at.x, from.at.y, r, 0, Math.PI * 2)
      ctx.stroke()
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4
        ctx.beginPath()
        ctx.moveTo(from.at.x + 1.45 * r * Math.cos(a), from.at.y + 1.45 * r * Math.sin(a))
        ctx.lineTo(from.at.x + 2 * r * Math.cos(a), from.at.y + 2 * r * Math.sin(a))
        ctx.stroke()
      }
    }
    const [a, b] = from.arrow
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.moveTo(b.x - 7, b.y - 6)
    ctx.lineTo(b.x, b.y)
    ctx.lineTo(b.x - 7, b.y + 6)
    ctx.stroke()
  }

  let begun = 0
  let finger: { p: Point; down: boolean } | null = null
  let last: Point | null = null
  let latest: { n: number; at: Point } | null = null
  const number = (c: { n: number; at: Point }) => {
    ctx.globalAlpha = alpha
    ctx.fillStyle = NUMBER
    ctx.font = hand(small * 0.13)
    ctx.fillText(String(c.n), c.at.x, c.at.y)
  }
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i]
    if (at < begun) break
    const u = Math.min(1, (at - begun) / step.ms)
    if (step.kind === 'stroke') {
      const upto = Math.max(1, Math.round(u * (step.pts.length - 1)))
      ctx.globalAlpha = alpha
      ctx.strokeStyle = GHOST
      ctx.lineWidth = 3.5
      ctx.beginPath()
      ctx.moveTo(step.pts[0].x, step.pts[0].y)
      for (let k = 1; k <= upto; k++) ctx.lineTo(step.pts[k].x, step.pts[k].y)
      ctx.stroke()
      if (u < 1) finger = { p: step.pts[upto], down: true }
      else if (step.count) {
        if (step.count.keep) number(step.count)
        else latest = step.count
      }
      last = step.pts[step.pts.length - 1]
    } else if (step.kind === 'letter') {
      ctx.globalAlpha = alpha * Math.min(1, 0.25 + 1.5 * u)
      ctx.fillStyle = GHOST
      ctx.font = hand(step.size)
      ctx.fillText(step.ch, step.at.x, step.at.y)
      if (u < 1) finger = { p: across(step, u), down: true }
      last = across(step, 1)
    } else {
      // The finger in the air, on its way to the next letter: orange dashes, as in the invisible ink.
      const next = plan.steps[i + 1]
      const to = next?.kind === 'letter' ? across(next, 0) : step.to
      const start = last ?? to
      const here = { x: start.x + (to.x - start.x) * ease(u), y: start.y + (to.y - start.y) * ease(u) - Math.sin(Math.PI * u) * small * 0.07 }
      ctx.globalAlpha = alpha * 0.55
      ctx.strokeStyle = AIR
      ctx.lineWidth = 2
      ctx.setLineDash([4, 6])
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
      ctx.quadraticCurveTo((start.x + to.x) / 2, (start.y + to.y) / 2 - small * 0.14, u < 1 ? here.x : to.x, u < 1 ? here.y : to.y)
      ctx.stroke()
      ctx.setLineDash([])
      if (u < 1) finger = { p: here, down: false }
      last = to
    }
    begun += step.ms
  }
  if (latest) number(latest)
  if (!finger) return
  // The finger: full when it touches, a ring when it is in the air.
  ctx.globalAlpha = alpha * 0.18
  ctx.fillStyle = AIR
  ctx.beginPath()
  ctx.arc(finger.p.x, finger.p.y, 18, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = alpha * 0.85
  ctx.beginPath()
  ctx.arc(finger.p.x, finger.p.y, 9, 0, Math.PI * 2)
  if (finger.down) ctx.fill()
  else {
    ctx.strokeStyle = AIR
    ctx.lineWidth = 2.5
    ctx.stroke()
  }
}

export default function Demo({ task, prompt, example, tag }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const plan = () => {
      const { width, height } = canvas.getBoundingClientRect()
      return demoFor(task, { w: width, h: height }, { prompt, example })
    }
    let now = plan()
    let total = duration(now)
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const started = performance.now() + WAIT
    let frame = 0
    const tick = (time: number) => {
      const t = Math.max(0, time - started) % (total + REST)
      const left = total + REST - t
      paint(canvas, now, Math.min(t, total), left < FADE ? left / FADE : 1)
      frame = requestAnimationFrame(tick)
    }
    const still = () => {
      now = plan()
      total = duration(now)
      if (calm) paint(canvas, now, total, 1)
    }
    still()
    if (!calm) frame = requestAnimationFrame(tick)
    window.addEventListener('resize', still)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', still)
    }
  }, [task, prompt, example])

  return (
    <div className="hint demo" aria-hidden="true">
      <canvas ref={ref} />
      <span className="demo-tag">{tag}</span>
    </div>
  )
}
