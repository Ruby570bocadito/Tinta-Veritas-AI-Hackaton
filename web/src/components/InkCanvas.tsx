import { useEffect, useRef } from 'react'
import { gaps, type Stroke } from '../lib/ink'

export type Guide = 'hline' | 'vline' | 'circle'

export type Size = { w: number; h: number }

type Props = {
  strokes: Stroke[]
  onChange?: (strokes: Stroke[], sheet: Size) => void // omit to make the canvas read-only
  onStart?: () => void // the finger has just touched the sheet (the example on it can go away)
  from?: Size // size of the sheet the strokes were written on, so a smaller replay shows all of it
  showInvisibleInk?: boolean // replay the writing and reveal the pauses in orange
  guide?: Guide
}

const INK = '#1c2340'
const AIR = '#e8622a'
const GUIDE = '#8c7b57'
const CM = 37.8 // CSS pixels per centimetre
const REPLAY_MS = [1400, 4200] // the replay is squeezed or stretched to last between these

/** Draws the sheet. With `until`, only what had happened by that moment (used by the replay). */
function draw(canvas: HTMLCanvasElement, strokes: Stroke[], invisible: boolean, guide?: Guide, until = Infinity, from?: Size) {
  const ctx = canvas.getContext('2d')!
  const ratio = window.devicePixelRatio || 1
  const { width, height } = canvas.getBoundingClientRect()
  if (canvas.width !== Math.round(width * ratio)) {
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // The replay sheet is smaller than the one the person wrote on: shrink the drawing to fit, centred.
  let w = width
  let h = height
  if (from) {
    const k = Math.min(width / from.w, height / from.h)
    ctx.translate((width - from.w * k) / 2, (height - from.h * k) / 2)
    ctx.scale(k, k)
    w = from.w
    h = from.h
  }

  // Printed guide, like the sheet of paper in the original study.
  const cx = w / 2
  const cy = h / 2
  ctx.fillStyle = GUIDE
  ctx.strokeStyle = GUIDE
  ctx.lineWidth = 2
  ctx.setLineDash([])
  const dot = (x: number, y: number) => {
    ctx.beginPath()
    ctx.arc(x, y, 7, 0, Math.PI * 2)
    ctx.fill()
  }
  if (guide === 'hline') {
    dot(cx - w * 0.32, cy)
    dot(cx + w * 0.32, cy)
  } else if (guide === 'vline') {
    dot(cx, cy - h * 0.32)
    dot(cx, cy + h * 0.32)
  } else if (guide === 'circle') {
    ctx.beginPath()
    ctx.arc(cx, cy, CM * 1.5, 0, Math.PI * 2) // 3 cm across, as in the study
    ctx.stroke()
  }

  ctx.strokeStyle = INK
  ctx.fillStyle = INK
  ctx.lineWidth = 3
  for (const stroke of strokes) {
    const s = until === Infinity ? stroke : stroke.filter((p) => p.t <= until)
    if (s.length === 0) continue
    if (s.length === 1) {
      ctx.beginPath()
      ctx.arc(s[0].x, s[0].y, 1.5, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    // A curve through the middle of each pair of points: the same ink, without the corners of straight segments.
    ctx.beginPath()
    ctx.moveTo(s[0].x, s[0].y)
    for (let i = 1; i < s.length - 1; i++) ctx.quadraticCurveTo(s[i].x, s[i].y, (s[i].x + s[i + 1].x) / 2, (s[i].y + s[i + 1].y) / 2)
    ctx.lineTo(s[s.length - 1].x, s[s.length - 1].y)
    ctx.stroke()
  }

  if (!invisible) return
  // Invisible ink: where the finger travelled off the screen, and how long it waited.
  // A phone cannot see the finger in the air, so the path is a straight line (an honest guess);
  // the waiting time is measured, and sets the size of the circle.
  ctx.strokeStyle = AIR
  ctx.fillStyle = AIR
  ctx.lineWidth = 2
  for (const g of gaps(strokes)) {
    if (g.from.t > until) continue
    const waited = Math.min(until, g.to.t) - g.from.t
    ctx.globalAlpha = 0.4
    ctx.beginPath()
    ctx.arc(g.from.x, g.from.y, Math.min(40, 3 + Math.sqrt(waited) / 2.5), 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    if (until < g.to.t) continue
    ctx.setLineDash([5, 6])
    ctx.beginPath()
    ctx.moveTo(g.from.x, g.from.y)
    ctx.lineTo(g.to.x, g.to.y)
    ctx.stroke()
    ctx.setLineDash([])
  }
}

export default function InkCanvas({ strokes, onChange, onStart, showInvisibleInk = false, guide, from }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const live = useRef<Stroke[]>(strokes)
  const drawing = useRef(false)

  useEffect(() => {
    // Not in the middle of a stroke: the screen may draw itself again while the finger is down (the example
    // on the sheet goes away at the first touch), and the stroke being written must not be thrown away.
    if (!drawing.current) live.current = strokes
    const canvas = ref.current!
    const still = () => draw(canvas, live.current, showInvisibleInk, guide, Infinity, from)
    window.addEventListener('resize', still)

    // Replay: the writing draws itself again and each pause swells in orange while it lasts.
    const points = strokes.flat()
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    if (showInvisibleInk && points.length > 1 && !calm) {
      const first = points[0].t
      const total = points[points.length - 1].t - first
      const length = Math.min(REPLAY_MS[1], Math.max(REPLAY_MS[0], total))
      const started = performance.now()
      const tick = (now: number) => {
        const progress = Math.min(1, (now - started) / length)
        draw(canvas, strokes, true, guide, first + progress * total, from)
        if (progress < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    } else {
      still()
    }
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', still)
    }
  }, [strokes, showInvisibleInk, guide, from])

  const point = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }
  }

  // Only the first finger writes. A second finger, or the side of the hand resting on the glass, would
  // otherwise count as extra touches, and touches are one of the two things the model reads.
  const down = (e: React.PointerEvent) => {
    if (!onChange || !e.isPrimary) return
    e.currentTarget.setPointerCapture(e.pointerId)
    onStart?.()
    drawing.current = true
    live.current = [...live.current, [point(e)]]
    draw(ref.current!, live.current, false, guide)
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !e.isPrimary) return
    live.current[live.current.length - 1].push(point(e))
    draw(ref.current!, live.current, false, guide)
  }
  const up = (e: React.PointerEvent) => {
    if (!drawing.current || !e.isPrimary) return
    drawing.current = false
    const r = ref.current!.getBoundingClientRect()
    onChange?.(live.current, { w: r.width, h: r.height })
  }

  return (
    <canvas
      ref={ref}
      className={'ink' + (onChange ? '' : ' ink-readonly')}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      aria-label={onChange ? 'Writing area' : 'Your writing with invisible ink shown'}
    />
  )
}
