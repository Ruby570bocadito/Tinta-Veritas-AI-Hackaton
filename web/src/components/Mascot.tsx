// Tinta, a paper cut-out squid who lends you her ink.
// Every pose is an image made for this project (see README, Sources).
export type Mood =
  | 'hello'
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
  | 'task-phone'
  | 'task-reverse'
  | 'task-copy'
  | 'closer-look'
  | 'read'

type Props = { mood?: Mood; size?: number; label?: string }

export default function Mascot({ mood = 'hello', size = 120, label }: Props) {
  return (
    <img
      className={'mascot mascot-' + mood}
      src={`${import.meta.env.BASE_URL}img/tinta-${mood}.webp`}
      width={size}
      height={size}
      style={{ '--size': size + 'px' } as React.CSSProperties}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
    />
  )
}
