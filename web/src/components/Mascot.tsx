import { useEffect, useState, type CSSProperties } from 'react'

// Tinta, a paper cut-out squid who lends you her ink.
// Every pose is an image made for this project (see README, Sources).
// She pops in, floats, wiggles when you tap her and, for the poses that have a second frame, blinks.
export type Mood =
  | 'hello'
  | 'wave'
  | 'watching'
  | 'happy'
  | 'unsure'
  | 'caring'
  | 'writing'
  | 'onb-pauses'
  | 'onb-yourself'
  | 'onb-private'
  | 'onb-calm'
  | 'task-warmup'
  | 'task-lines'
  | 'task-circle'
  | 'task-loops'
  | 'task-reverse'
  | 'task-copy'
  | 'closer-look'
  | 'read'
  | 'jump'
  | 'shrug'
  | 'think'
  | 'finger-tap'
  | 'stopwatch-sad'
  | 'point-down'
  | 'thumbs'

// Poses with an eyes-closed frame in public/img (tinta-<mood>-blink.webp).
const BLINKS: Mood[] = ['wave', 'watching', 'caring', 'unsure', 'writing', 'closer-look', 'read', 'thumbs', 'jump', 'shrug', 'think', 'finger-tap', 'point-down', 'stopwatch-sad']

type Props = { mood?: Mood; size?: number; label?: string }

const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Mascot({ mood = 'hello', size = 120, label }: Props) {
  const [closed, setClosed] = useState(false)
  const [poked, setPoked] = useState(false)
  const blinks = BLINKS.includes(mood)
  const src = (name: string) => `${import.meta.env.BASE_URL}img/tinta-${name}.webp`

  useEffect(() => {
    if (!blinks || still()) return
    new Image().src = src(mood + '-blink') // load it before the first blink, so there is no flash
    let timer: number
    const wait = () => {
      timer = window.setTimeout(() => {
        setClosed(true)
        timer = window.setTimeout(() => {
          setClosed(false)
          wait()
        }, 150)
      }, 2200 + Math.random() * 3200)
    }
    wait()
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, blinks])

  return (
    <img
      className={'mascot mascot-' + mood + (poked ? ' poked' : '')}
      src={src(closed ? mood + '-blink' : mood)}
      width={size}
      height={size}
      style={{ '--size': size + 'px' } as CSSProperties}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
      onClick={() => {
        setPoked(true)
        navigator.vibrate?.(10)
        window.setTimeout(() => setPoked(false), 700)
      }}
    />
  )
}
