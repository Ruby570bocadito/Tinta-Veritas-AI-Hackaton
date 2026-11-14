import { useState } from 'react'
import InkCanvas, { type Guide } from './components/InkCanvas'
import { measure, seconds, type Measures, type Stroke } from './lib/ink'
import { counts, examples, metrics, predict, slowdown, verdict, TASK_IDS, WARMUP_IDS, type Verdict } from './lib/model'

type Task = { id: number; title: string; instruction: string; prompt?: string; speak?: string; guide?: Guide }

// Five of the 25 tasks of the DARWIN protocol (numbers are the original task numbers).
// 2 and 3 are warm-ups that measure the person's own pace; 5, 9 and 23 are scored against it.
const TASKS: Task[] = [
  {
    id: 2,
    title: 'Warm-up: side to side',
    instruction: 'Join the two dots with a line, back and forth four times, without lifting your finger.',
    guide: 'hline',
  },
  {
    id: 3,
    title: 'Warm-up: up and down',
    instruction: 'Join the two dots with a line, up and down four times, without lifting your finger.',
    guide: 'vline',
  },
  {
    id: 5,
    title: 'Circle',
    instruction: 'Trace over the circle four times in a row, without lifting your finger.',
    guide: 'circle',
  },
  {
    id: 9,
    title: 'Loops',
    instruction: 'Write "le" four times in joined-up writing, in one smooth movement.',
    prompt: 'le le le le',
  },
  {
    id: 23,
    title: 'Phone number',
    instruction: 'Tap "Listen", then write the phone number you hear.',
    speak: '3 4 7. 5 9 2. 0 1 6 8',
  },
]

const VERDICTS: Record<Verdict, { title: string; body: string }> = {
  typical: {
    title: 'Within the usual pattern',
    body: 'Compared with your own warm-up pace, the harder tasks slowed you down about as much as the healthy group in the study.',
  },
  unsure: {
    title: "I can't tell from this",
    body: 'The pattern sits between the two groups. Try again another day, in a calm moment.',
  },
  mention: {
    title: 'Worth mentioning to a doctor',
    body: 'Compared with your own warm-up pace, the harder tasks slowed you down more like the patient group in the study. This is not a diagnosis.',
  },
}

function say(text: string) {
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.8
  u.lang = 'en-US'
  speechSynthesis.cancel()
  speechSynthesis.speak(u)
}

type Screen = { name: 'intro' } | { name: 'task'; index: number; review: boolean } | { name: 'result' }

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'intro' })
  const [ink, setInk] = useState<Record<number, Stroke[]>>({})
  const [example, setExample] = useState<number | null>(null)

  const restart = () => {
    setInk({})
    setExample(null)
    setScreen({ name: 'intro' })
  }

  if (screen.name === 'intro') {
    return (
      <main className="page">
        <p className="brand">Tinta</p>
        <h1>How you write says more than what you write.</h1>
        <p className="lead">
          Five short writing tasks, about two minutes. Tinta times the pauses your eye can't see and compares them with
          data from 174 people, 89 of them living with Alzheimer's.
        </p>
        <button className="primary" onClick={() => setScreen({ name: 'task', index: 0, review: false })}>
          Start the check
        </button>
        <button
          className="ghost"
          onClick={() => {
            setExample(0)
            setScreen({ name: 'result' })
          }}
        >
          See a real case from the study
        </button>
        <p className="fine">This project is a prototype and is not medical advice. Nothing you write leaves this device.</p>
      </main>
    )
  }

  if (screen.name === 'task') {
    const task = TASKS[screen.index]
    const strokes = ink[task.id] ?? []
    const m = measure(strokes)
    const last = screen.index === TASKS.length - 1
    return (
      <main className="page">
        <p className="step">
          Task {screen.index + 1} of {TASKS.length} · {task.title}
        </p>
        <h2>{screen.review ? 'Your invisible ink' : task.instruction}</h2>
        {task.prompt && !screen.review && <p className="prompt">{task.prompt}</p>}
        {task.speak && !screen.review && (
          <button className="ghost" onClick={() => say(task.speak!)}>
            ▶ Listen
          </button>
        )}
        <InkCanvas
          key={task.id + (screen.review ? 'r' : 'w')}
          strokes={strokes}
          guide={task.guide}
          onChange={screen.review ? undefined : (s) => setInk({ ...ink, [task.id]: [...s] })}
          showInvisibleInk={screen.review}
        />
        {screen.review ? (
          <>
            <p className="legend">
              <span className="dot air" /> Orange shows where your finger was off the screen. Bigger circles mean
              longer pauses.
            </p>
            <dl className="stats">
              <div>
                <dt>In the air</dt>
                <dd>{seconds(m.air_time)}</dd>
              </div>
              <div>
                <dt>On the screen</dt>
                <dd>{seconds(m.paper_time)}</dd>
              </div>
              <div>
                <dt>Touches</dt>
                <dd>{m.num_of_pendown}</dd>
              </div>
            </dl>
            <button
              className="primary"
              onClick={() =>
                setScreen(last ? { name: 'result' } : { name: 'task', index: screen.index + 1, review: false })
              }
            >
              {last ? 'See the result' : 'Next task'}
            </button>
          </>
        ) : (
          <div className="row">
            <button className="ghost" onClick={() => setInk({ ...ink, [task.id]: [] })} disabled={!strokes.length}>
              Clear
            </button>
            <button
              className="primary"
              onClick={() => setScreen({ ...screen, review: true })}
              disabled={!strokes.length}
            >
              Done
            </button>
          </div>
        )}
      </main>
    )
  }

  // Result: either the person's own writing or a held-out case from the study.
  const ex = example === null ? null : examples[example]
  const byTask: Record<number, Measures> = {}
  for (const id of [...WARMUP_IDS, ...TASK_IDS]) {
    byTask[id] = ex ? (ex.measures as Record<string, Measures>)[String(id)] : measure(ink[id] ?? [])
  }
  const p = predict(byTask)
  const v = VERDICTS[verdict(p)]
  const same = metrics['1.0']
  const slow = metrics['1.5']
  return (
    <main className="page">
      <p className="step">{ex ? `Real case from the study · actually ${ex.label}` : 'Your result'}</p>
      <h1 className={'verdict ' + verdict(p)}>{v.title}</h1>
      <p className="lead">{v.body}</p>
      <div className="meter" role="img" aria-label={`Model score ${Math.round(p * 100)} out of 100`}>
        <div className="meter-fill" style={{ width: `${Math.round(p * 100)}%` }} />
      </div>
      <p className="fine">Model score {Math.round(p * 100)}/100. Below 35 is the usual pattern, above 65 is worth mentioning.</p>
      <table className="table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Slower than your warm-up</th>
            <th>In the air</th>
            <th>Touches</th>
          </tr>
        </thead>
        <tbody>
          {TASKS.filter((t) => TASK_IDS.includes(t.id)).map((t) => (
            <tr key={t.id}>
              <td>{t.title}</td>
              <td>×{slowdown(byTask, t.id).toFixed(1)}</td>
              <td>{Math.round((100 * byTask[t.id].air_time) / Math.max(byTask[t.id].total_time, 1))}%</td>
              <td>{byTask[t.id].num_of_pendown}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {ex && (
        <button className="ghost" onClick={() => setExample((example! + 1) % examples.length)}>
          Next real case ({example! + 1} of {examples.length})
        </button>
      )}
      <section className="honest">
        <h2>How well does it work?</h2>
        <p>
          Trained on {counts.train} people, checked on {counts.test} it never saw ({same.model.patients} patients,{' '}
          {same.model.healthy} healthy). Tinta missed {same.model.missed} patients and raised {same.model.false_alarms}{' '}
          false alarms. A plain stopwatch rule missed {same.stopwatch.missed} and raised {same.stopwatch.false_alarms}:
          on the study's own tablet, the stopwatch is slightly better.
        </p>
        <p>
          But a phone is not that tablet. If the device makes everyone 1.5 times slower, the stopwatch raises{' '}
          {slow.stopwatch.false_alarms} false alarms out of {slow.stopwatch.healthy} healthy people. Tinta still raises{' '}
          {slow.model.false_alarms}, because it compares you with your own warm-up, not with a clock.
        </p>
        <p>
          The study used a pen on a tablet, in Italian. Tinta uses a finger on a phone. We have not tested it with
          patients on a phone, so treat a result as a reason to talk to a doctor, never as an answer.
        </p>
      </section>
      <button className="primary" onClick={restart}>
        Start again
      </button>
      <p className="fine">This project is a prototype and is not medical advice.</p>
    </main>
  )
}
