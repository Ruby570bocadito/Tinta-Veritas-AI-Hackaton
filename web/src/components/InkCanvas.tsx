import { useEffect, useRef } from 'react'
import { gaps, type Stroke } from '../lib/ink'

export type Guide = 'hline' | 'vline' | 'circle'

type Props = {
  strokes: Stroke[]
  onChange?: (strokes: Stroke[]) => void // omit to make the canvas read-only
  showInvisibleInk?: boolean
  guide?: Guide
}

const INK = '#1c2340'
const AIR = '#e8622a'
const GUIDE = '#d6c7a8'
const CM = 37.8 // CSS pixels per centimetre

function draw(canvas: HTMLCanvasElement, strokes: Stroke[], invisible: boolean, guide?: Guide) {
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

  // Printed guide, like the sheet of paper in the original study.
  const cx = width / 2
  const cy = height / 2
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
    dot(cx - width * 0.32, cy)
    dot(cx + width * 0.32, cy)
  } else if (guide === 'vline') {
    dot(cx, cy - height * 0.32)
    dot(cx, cy + height * 0.32)
  } else if (guide === 'circle') {
    ctx.beginPath()
    ctx.arc(cx, cy, CM * 1.5, 0, Math.PI * 2) // 3 cm across, as in the study
    ctx.stroke()
  }

  ctx.strokeStyle = INK
  ctx.fillStyle = INK
  ctx.lineWidth = 3
  ctx.setLineDash([])
  for (const s of strokes) {
    if (s.length === 1) {
      ctx.beginPath()
      ctx.arc(s[0].x, s[0].y, 1.5, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    ctx.beginPath()
    s.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
    ctx.stroke()
  }

  if (!invisible) return
  // Invisible ink: where the finger travelled off the screen, and how long it waited.
  // A phone cannot see the finger in the air, so the path is a straight line (an honest guess);
  // the waiting time is measured, and sets the size of the circle.
  ctx.strokeStyle = AIR
  ctx.lineWidth = 2
  for (const g of gaps(strokes)) {
    ctx.setLineDash([5, 6])
    ctx.beginPath()
    ctx.moveTo(g.from.x, g.from.y)
    ctx.lineTo(g.to.x, g.to.y)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 0.25
    ctx.fillStyle = AIR
    ctx.beginPath()
    ctx.arc(g.from.x, g.from.y, Math.min(40, 3 + Math.sqrt(g.ms) / 2.5), 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

export default function InkCanvas({ strokes, onChange, showInvisibleInk = false, guide }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const live = useRef<Stroke[]>(strokes)
  const drawing = useRef(false)

  useEffect(() => {
    live.current = strokes
    const canvas = ref.current!
    const redraw = () => draw(canvas, live.current, showInvisibleInk, guide)
    redraw()
    window.addEventListener('resize', redraw)
    return () => window.removeEventListener('resize', redraw)
  }, [strokes, showInvisibleInk, guide])

  const point = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }
  }

  const down = (e: React.PointerEvent) => {
    if (!onChange) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    live.current = [...live.current, [point(e)]]
    draw(ref.current!, live.current, false, guide)
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    live.current[live.current.length - 1].push(point(e))
    draw(ref.current!, live.current, false, guide)
  }
  const up = () => {
    if (!drawing.current) return
    drawing.current = false
    onChange?.(live.current)
  }

  return (
    <canvas
      ref={ref}
      className={'ink' + (onChange ? '' : ' ink-readonly')}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      aria-label={onChange ? 'Writing area' : 'Your writing with invisible ink shown'}
    />
  )
}
