import type { Entry } from '../lib/history'

// A small paper chart of the person's own past scores. The three bands are the same as the score bar.
const W = 300
const H = 120
const PAD = 14

export default function History({ entries, locale }: { entries: Entry[]; locale: string }) {
  const shown = entries.slice(-8)
  const x = (i: number) => (shown.length === 1 ? W / 2 : PAD + (i * (W - 2 * PAD)) / (shown.length - 1))
  const y = (score: number) => PAD + ((100 - score) * (H - 2 * PAD)) / 100
  const day = (t: number) => new Date(t).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  return (
    <svg className="history" viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label={shown.map((e) => `${day(e.t)}: ${e.score}`).join(', ')}>
      <rect x="0" y={y(100)} width={W} height={y(65) - y(100)} fill="#e8622a" opacity="0.16" />
      <rect x="0" y={y(65)} width={W} height={y(35) - y(65)} fill="#dccfb8" opacity="0.35" />
      <rect x="0" y={y(35)} width={W} height={y(0) - y(35)} fill="#1f6a4a" opacity="0.14" />
      {shown.length > 1 && (
        <polyline
          points={shown.map((e, i) => `${x(i)},${y(e.score)}`).join(' ')}
          fill="none"
          stroke="#27305a"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {shown.map((e, i) => (
        <circle key={e.t} cx={x(i)} cy={y(e.score)} r={i === shown.length - 1 ? 7 : 5} fill={i === shown.length - 1 ? '#e8622a' : '#27305a'} stroke="#fffaf0" strokeWidth="2" />
      ))}
      <text x={x(0)} y={H + 14} textAnchor={shown.length === 1 ? 'middle' : 'start'} className="history-label">
        {day(shown[0].t)}
      </text>
      {shown.length > 1 && (
        <text x={x(shown.length - 1)} y={H + 14} textAnchor="end" className="history-label">
          {day(shown[shown.length - 1].t)}
        </text>
      )}
    </svg>
  )
}
