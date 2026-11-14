// Tinta, a small squid who lends you her ink. Drawn by hand as SVG so she is sharp at any size.
export type Mood = 'hello' | 'watching' | 'happy' | 'unsure' | 'caring'

type Props = { mood?: Mood; size?: number; label?: string }

const BODY = '#2b3654'
const BELLY = '#3d4a70'
const BLUSH = '#e4572e'

export default function Mascot({ mood = 'hello', size = 120, label }: Props) {
  const closed = mood === 'happy'
  const look = mood === 'watching' ? { x: 0, y: 3 } : mood === 'unsure' ? { x: 3, y: -2 } : { x: 0, y: 0 }
  const mouth = {
    hello: 'M52 74 Q60 82 68 74',
    watching: 'M55 76 Q60 79 65 76',
    happy: 'M50 73 Q60 85 70 73',
    unsure: 'M54 78 Q58 74 62 78 Q65 81 68 77',
    caring: 'M53 75 Q60 80 67 75',
  }[mood]
  return (
    <svg
      className={'mascot mascot-' + mood}
      width={size}
      height={(size * 140) / 120}
      viewBox="0 0 120 140"
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <g className="mascot-bob">
        {/* tentacles */}
        <g fill="none" stroke={BODY} strokeWidth="7" strokeLinecap="round">
          <path d="M38 86 Q30 104 36 122" />
          <path d="M49 90 Q46 110 50 130" />
          <path d="M60 91 Q62 112 60 132" />
          <path d="M71 90 Q76 110 70 130" />
          <path className="mascot-arm" d="M82 86 Q96 96 98 112" />
        </g>
        {/* the pen she writes with */}
        {mood === 'hello' && (
          <g className="mascot-arm">
            <path d="M94 118 L110 92" stroke="#1d2433" strokeWidth="4" strokeLinecap="round" />
            <path d="M94 118 L92 124 L98 121 Z" fill={BLUSH} />
          </g>
        )}
        {/* fins and mantle */}
        <ellipse cx="24" cy="30" rx="12" ry="8" fill={BODY} transform="rotate(-30 24 30)" />
        <ellipse cx="96" cy="30" rx="12" ry="8" fill={BODY} transform="rotate(30 96 30)" />
        <path d="M60 6 C92 6 104 40 100 68 C98 84 90 94 60 94 C30 94 22 84 20 68 C16 40 28 6 60 6 Z" fill={BODY} />
        <path d="M60 50 C80 50 90 62 88 76 C86 88 78 92 60 92 C42 92 34 88 32 76 C30 62 40 50 60 50 Z" fill={BELLY} />
        {/* face */}
        <circle cx="36" cy="70" r="6" fill={BLUSH} opacity="0.45" />
        <circle cx="84" cy="70" r="6" fill={BLUSH} opacity="0.45" />
        {closed ? (
          <g fill="none" stroke="#fffdf8" strokeWidth="3.5" strokeLinecap="round">
            <path d="M37 58 Q45 50 53 58" />
            <path d="M67 58 Q75 50 83 58" />
          </g>
        ) : (
          <g className="mascot-eyes">
            <circle cx="45" cy="56" r="11" fill="#fffdf8" />
            <circle cx="75" cy="56" r="11" fill="#fffdf8" />
            <circle cx={45 + look.x} cy={57 + look.y} r="5.5" fill="#1d2433" />
            <circle cx={75 + look.x} cy={57 + look.y} r="5.5" fill="#1d2433" />
            <circle cx={47 + look.x} cy={55 + look.y} r="1.8" fill="#fffdf8" />
            <circle cx={77 + look.x} cy={55 + look.y} r="1.8" fill="#fffdf8" />
          </g>
        )}
        {mood === 'unsure' && <path d="M66 40 Q75 35 84 41" fill="none" stroke="#fffdf8" strokeWidth="3" strokeLinecap="round" />}
        <path d={mouth} fill="none" stroke="#fffdf8" strokeWidth="3" strokeLinecap="round" />
      </g>
    </svg>
  )
}
