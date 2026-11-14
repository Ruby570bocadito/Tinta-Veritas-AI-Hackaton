import { useEffect, useRef } from 'react'
import { gaps, type Stroke } from '../lib/ink'

type Props = {
  strokes: Stroke[]
  onChange?: (strokes: Stroke[]) => void // omit to make the canvas read-only
  showInvisibleInk?: boolean
}

const INK = '#1d2433'
const AIR = '#e4572e'

function draw(canvas: HTMLCanvasElement, strokes: Stroke[], invisible: boolean) {
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

export default function InkCanvas({ strokes, onChange, showInvisibleInk = false }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const live = useRef<Stroke[]>(strokes)
  const drawing = useRef(false)

  useEffect(() => {
    live.current = strokes
    const canvas = ref.current!
    const redraw = () => draw(canvas, live.current, showInvisibleInk)
    redraw()
    window.addEventListener('resize', redraw)
    return () => window.removeEventListener('resize', redraw)
  }, [strokes, showInvisibleInk])

  const point = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }
  }

  const down = (e: React.PointerEvent) => {
    if (!onChange) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    live.current = [...live.current, [point(e)]]
    draw(ref.current!, live.current, false)
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    live.current[live.current.length - 1].push(point(e))
    draw(ref.current!, live.current, false)
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
