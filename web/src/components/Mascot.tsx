// Tinta, a paper cut-out squid who lends you her ink.
// The six poses are images made for this project (see README, Sources).
export type Mood = 'hello' | 'watching' | 'happy' | 'unsure' | 'caring' | 'writing'

type Props = { mood?: Mood; size?: number; label?: string }

export default function Mascot({ mood = 'hello', size = 120, label }: Props) {
  return (
    <img
      className={'mascot mascot-' + mood}
      src={`${import.meta.env.BASE_URL}img/tinta-${mood}.webp`}
      width={size}
      height={size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
    />
  )
}
