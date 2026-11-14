// "You among the 174": one dot per person in the study, healthy above the line and patients below,
// placed by the short-check score a model gave them without having seen them. The dark line is this result.
// The two groups overlap in the middle, and the chart is here so that anyone can see it.
const W = 300
const BIN = 5 // score points per column
const STEP = 7.4 // distance between stacked dots
const R = 3.1
const AXIS = 20

type Props = { healthy: number[]; patients: number[]; you: number; label: string; aria: string }

function columns(scores: number[]) {
  const counts: number[] = new Array(100 / BIN).fill(0)
  for (const s of scores) counts[Math.min(counts.length - 1, Math.floor(s / BIN))]++
  return counts
}

export default function Crowd({ healthy, patients, you, label, aria }: Props) {
  const up = columns(healthy)
  const down = columns(patients)
  const top = Math.max(...up) * STEP + 22 // room for the label above the tallest column
  const H = top + AXIS + Math.max(...down) * STEP + 6
  const x = (score: number) => (score * W) / 100
  const cx = (col: number) => x(col * BIN + BIN / 2)
  const mine = Math.max(1.5, Math.min(W - 1.5, x(you)))
  return (
    <svg className="crowd" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria}>
      <rect x={x(0)} y="0" width={x(35)} height={H} fill="#1f6a4a" opacity="0.1" />
      <rect x={x(35)} y="0" width={x(30)} height={H} fill="#dccfb8" opacity="0.35" />
      <rect x={x(65)} y="0" width={x(35)} height={H} fill="#e8622a" opacity="0.12" />
      {up.map((n, col) =>
        Array.from({ length: n }, (_, k) => <circle key={`h${col}-${k}`} cx={cx(col)} cy={top - R - 1 - k * STEP} r={R} fill="#1f6a4a" />),
      )}
      {down.map((n, col) =>
        Array.from({ length: n }, (_, k) => <circle key={`p${col}-${k}`} cx={cx(col)} cy={top + AXIS + R + 1 + k * STEP} r={R} fill="#e8622a" />),
      )}
      {[0, 35, 65, 100].map((s) => (
        <text key={s} x={x(s)} y={top + 14} textAnchor={s === 0 ? 'start' : s === 100 ? 'end' : 'middle'} className="history-label">
          {s}
        </text>
      ))}
      <line x1={mine} x2={mine} y1="14" y2={top - 1} stroke="#27305a" strokeWidth="2.5" strokeLinecap="round" />
      <line x1={mine} x2={mine} y1={top + AXIS + 1} y2={H} stroke="#27305a" strokeWidth="2.5" strokeLinecap="round" />
      <text x={mine} y="11" textAnchor={you < 12 ? 'start' : you > 88 ? 'end' : 'middle'} className="crowd-you">
        {label}
      </text>
    </svg>
  )
}
