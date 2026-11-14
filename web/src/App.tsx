import { useState } from 'react'
import InkCanvas, { type Guide } from './components/InkCanvas'
import Mascot, { type Mood } from './components/Mascot'
import { measure, seconds, type Measures, type Stroke } from './lib/ink'
import {
  counts,
  examples,
  isGrey,
  metrics,
  predict,
  predictCloser,
  reference,
  slowdown,
  verdict,
  EXTRA_IDS,
  TASK_IDS,
  WARMUP_IDS,
  type Verdict,
} from './lib/model'

type Task = {
  id: number
  title: string
  instruction: string
  pose: Mood
  prompt?: string
  speak?: string
  guide?: Guide
  picture?: string // an image to name, for the naming task
}

// Five of the 25 tasks of the DARWIN protocol (numbers are the original task numbers).
// 2 and 3 are warm-ups that measure the person's own pace; 5, 9 and 23 are scored against it.
const TASKS: Task[] = [
  {
    id: 2,
    pose: 'task-warmup',
    title: 'Warm-up',
    instruction: 'Join the two dots with a line, back and forth four times, without lifting your finger.',
    guide: 'hline',
  },
  {
    id: 3,
    pose: 'task-lines',
    title: 'Warm-up',
    instruction: 'Now up and down: join the two dots four times, without lifting your finger.',
    guide: 'vline',
  },
  {
    id: 5,
    pose: 'task-circle',
    title: 'Circle',
    instruction: 'Trace over the circle four times in a row, without lifting your finger.',
    guide: 'circle',
  },
  {
    id: 9,
    pose: 'task-loops',
    title: 'Loops',
    instruction: 'Write "le" four times in joined-up writing, in one smooth movement.',
    prompt: 'le le le le',
  },
  {
    id: 23,
    pose: 'task-phone',
    title: 'Phone number',
    instruction: 'Tap "Listen", then write the phone number you hear.',
    speak: '3 4 7. 5 9 2. 0 1 6 8',
  },
]

// Three more tasks (15, 18 and 22 of the original protocol), asked only when the short check is unsure.
const EXTRA: Task[] = [
  {
    id: 15,
    title: 'Backwards',
    pose: 'task-reverse',
    instruction: 'Copy this word backwards, starting from its last letter.',
    prompt: 'bottle',
  },
  {
    id: 18,
    title: 'Name it',
    pose: 'watching',
    instruction: 'Write the name of the object in the picture.',
    picture: 'obj-chair',
  },
  {
    id: 22,
    title: 'Copy a number',
    pose: 'task-copy',
    instruction: 'Copy this phone number.',
    prompt: '091 748 2356',
  },
]

// A kind word after each task, so the person always knows where they are.
const CHEERS = [
  'Lovely. That was the first warm-up.',
  'Warm-ups done. Now the real ones.',
  'Nice circles! Two to go.',
  'Almost there. One more.',
  'That is all five. Thank you!',
  'Thank you. Two more.',
  'One more and we are done.',
  'That is everything. Thank you!',
]

// Plain next steps for each answer.
const NEXT_STEPS: Record<Verdict, string[]> = {
  typical: [
    'There is nothing you need to do today.',
    'Come back in a few months: the most useful comparison is you against you.',
  ],
  unsure: [
    'One unclear result means nothing on its own.',
    'Try again another day, rested and without hurry.',
  ],
  mention: [
    'Do not worry about a single result: tiredness or a new phone can cause it.',
    'Book a normal appointment with your family doctor and show the note below.',
    'Try again another day to see if the pattern repeats.',
  ],
}

const VERDICTS: Record<Verdict, { title: string; body: string; mood: Mood }> = {
  typical: {
    title: 'Within the usual pattern',
    body: 'Compared with your own warm-up pace, the harder tasks slowed you down about as much as the healthy group in the study.',
    mood: 'happy',
  },
  unsure: {
    title: "I can't tell from this",
    body: 'Your pattern sits between the two groups, so I would rather not guess. Try again another day, in a calm moment.',
    mood: 'unsure',
  },
  mention: {
    title: 'Worth mentioning to a doctor',
    body: 'Compared with your own warm-up pace, the harder tasks slowed you down more like the patient group in the study. This is not a diagnosis.',
    mood: 'caring',
  },
}

/** Why Tinta got a real case wrong, in plain words. Based on the measures, not on a guess. */
function whyWrong(label: string, byTask: Record<number, Measures>): string {
  const warm = Math.exp(WARMUP_IDS.reduce((s, t) => s + Math.log(byTask[t].total_time), 0) / WARMUP_IDS.length)
  if (label === 'patient') {
    return warm > 1.5 * reference.healthyWarmupMs
      ? `This patient was slow on the warm-ups too (${seconds(warm)} against ${seconds(reference.healthyWarmupMs)} for a typical healthy person). Tinta compares people with their own pace, so someone who is slow at everything looks "consistent". That is the price of not depending on the device.`
      : 'This patient wrote the three scored tasks at a healthy pace. Timing cannot see everything: other tasks of the full study might have shown it.'
  }
  return 'This healthy person slowed down a lot on the harder tasks, more than most healthy people. A hesitation, a distraction or an unfamiliar task looks the same as a cognitive pause to Tinta.'
}

// In the Android app the voice is native (Android WebView has no speech synthesis).
declare global {
  interface Window {
    TintaNative?: { speak(text: string): void }
  }
}

const canSpeak = Boolean(window.TintaNative) || 'speechSynthesis' in window

function say(text: string) {
  if (window.TintaNative) return window.TintaNative.speak(text)
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.8
  u.lang = 'en-US'
  speechSynthesis.cancel()
  speechSynthesis.speak(u)
}

const study = new URLSearchParams(location.search).has('study')
// For demos: ?closer always shows the closer look, whatever the first score is.
const forceCloser = new URLSearchParams(location.search).has('closer')
const isWrong = (e: (typeof examples)[number]) => e.p >= 0.5 !== (e.label === 'patient')

type Screen =
  | { name: 'intro' }
  | { name: 'guide'; step: number }
  | { name: 'ready' }
  | { name: 'task'; index: number; review: boolean }
  | { name: 'closer' }
  | { name: 'result' }

// What Tinta explains before the first check. Three ideas, one picture each.
const GUIDE: { pose: Mood; title: string; body: string }[] = [
  {
    pose: 'onb-pauses',
    title: "I time the pauses you can't see",
    body: 'Between one stroke and the next, your finger leaves the screen for a moment. Those tiny pauses grow when the mind has to work harder. Paper hides them. I can time them.',
  },
  {
    pose: 'onb-yourself',
    title: 'I compare you with yourself',
    body: 'Some people write fast, some slowly, and every phone is different. So I start with two easy warm-ups to learn your own pace, and measure the harder tasks against it. Not against a clock.',
  },
  {
    pose: 'onb-private',
    title: 'What you write stays here',
    body: 'Everything is worked out on this phone. Nothing is sent anywhere. And I am a student prototype, not a doctor: my answer is a reason to talk to one, never a diagnosis.',
  },
]

const TIPS = [
  'Pick a calm moment, sitting down.',
  'Lay the phone flat on a table.',
  'Use the finger you would point with.',
  'Wear your glasses if you need them.',
]

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'intro' })
  const [ink, setInk] = useState<Record<number, Stroke[]>>({})
  const [example, setExample] = useState<number | null>(null)
  const [closer, setCloser] = useState(false) // true once the person accepts the three extra tasks
  const [age, setAge] = useState('')
  const [copied, setCopied] = useState(false)

  const restart = () => {
    setInk({})
    setExample(null)
    setCopied(false)
    setCloser(false)
    setScreen({ name: 'intro' })
  }

  if (screen.name === 'intro') {
    return (
      <main className="page intro" key="intro">
        <header className="brandbar">
          <span className="brand">Tinta</span>
          <span className="tag">prototype</span>
        </header>
        <div className="hero">
          <Mascot mood="hello" size={170} label="Tinta, a paper cut-out squid holding a pencil" />
          <p className="bubble">Hi, I'm Tinta. Lend me your finger for two minutes?</p>
        </div>
        <h1>How you write says more than what you write.</h1>
        <p className="lead">
          A two-minute writing check for early signs of Alzheimer's, on the phone you already have. Built on data from
          174 people, 89 of them living with the disease.
        </p>
        <button className="primary" onClick={() => setScreen({ name: 'guide', step: 0 })}>
          Start
        </button>
        <button
          className="ghost"
          onClick={() => {
            setExample(0)
            setScreen({ name: 'result' })
          }}
        >
          See real cases from the study
        </button>
        <ul className="chips" aria-label="At a glance">
          <li>5 short tasks</li>
          <li>About 2 minutes</li>
          <li>Works offline</li>
        </ul>
        <p className="fine">
          This project is a prototype and is not medical advice. Nothing you write leaves this device.
        </p>
      </main>
    )
  }

  if (screen.name === 'guide') {
    const card = GUIDE[screen.step]
    const lastCard = screen.step === GUIDE.length - 1
    return (
      <main className="page" key={'guide' + screen.step}>
        <header className="brandbar">
          <span className="brand">Tinta</span>
          <button className="link" onClick={() => setScreen({ name: 'ready' })}>
            Skip
          </button>
        </header>
        <div className="poster">
          <Mascot mood={card.pose} size={230} />
        </div>
        <ol className="dots center" aria-label={`Step ${screen.step + 1} of ${GUIDE.length}`}>
          {GUIDE.map((g, i) => (
            <li key={g.pose} className={i < screen.step ? 'done' : i === screen.step ? 'now' : ''} />
          ))}
        </ol>
        <h1>{card.title}</h1>
        <p className="lead">{card.body}</p>
        <div className="row push">
          <button
            className="ghost"
            onClick={() => setScreen(screen.step ? { name: 'guide', step: screen.step - 1 } : { name: 'intro' })}
          >
            Back
          </button>
          <button
            className="primary"
            onClick={() => setScreen(lastCard ? { name: 'ready' } : { name: 'guide', step: screen.step + 1 })}
          >
            {lastCard ? 'Got it' : 'Next'}
          </button>
        </div>
      </main>
    )
  }

  if (screen.name === 'ready') {
    return (
      <main className="page" key="ready">
        <header className="brandbar">
          <span className="brand">Tinta</span>
        </header>
        <div className="poster">
          <Mascot mood="onb-calm" size={210} />
        </div>
        <h1>Ready when you are</h1>
        <ul className="tips">
          {TIPS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="lead">There are no right or wrong drawings. Just write the way you always do.</p>
        <div className="row push">
          <button className="ghost" onClick={() => setScreen({ name: 'guide', step: GUIDE.length - 1 })}>
            Back
          </button>
          <button className="primary" onClick={() => setScreen({ name: 'task', index: 0, review: false })}>
            Begin
          </button>
        </div>
      </main>
    )
  }

  if (screen.name === 'task') {
    const list = closer ? [...TASKS, ...EXTRA] : TASKS
    const task = list[screen.index]
    const strokes = ink[task.id] ?? []
    const m = measure(strokes)
    const last = screen.index === list.length - 1
    // After the fifth task Tinta already has a first answer. If it is unsure, she asks for a closer look.
    const afterShort = () => {
      const byTask: Record<number, Measures> = {}
      for (const id of [...WARMUP_IDS, ...TASK_IDS]) byTask[id] = measure(ink[id] ?? [])
      setScreen(!closer && (forceCloser || isGrey(predict(byTask))) ? { name: 'closer' } : { name: 'result' })
    }
    return (
      <main className="page" key={'task' + screen.index + screen.review}>
        <header className="taskbar">
          <Mascot mood={screen.review ? 'writing' : task.pose} size={96} />
          <div>
            <ol className="dots" aria-label={`Task ${screen.index + 1} of ${list.length}`}>
              {list.map((t, i) => (
                <li key={t.id} className={i < screen.index ? 'done' : i === screen.index ? 'now' : ''} />
              ))}
            </ol>
            <p className="step">
              Step {screen.index + 1} of {list.length} · {task.title}
            </p>
          </div>
          <button className="link quit" onClick={() => window.confirm('Stop the check and go back to the start?') && restart()}>
            Quit
          </button>
        </header>
        {screen.review && <p className="bubble cheer">{CHEERS[screen.index]}</p>}
        <h2>{screen.review ? 'Here is your invisible ink' : task.instruction}</h2>
        {task.prompt && !screen.review && <p className="prompt">{task.prompt}</p>}
        {task.picture && !screen.review && (
          <img className="picture" src={`${import.meta.env.BASE_URL}img/tinta-${task.picture}.webp`} alt="" width={150} height={150} />
        )}
        {task.speak && !screen.review && canSpeak && (
          <button className="ghost" onClick={() => say(task.speak!)}>
            ▶ Listen
          </button>
        )}
        {task.speak && !screen.review && !canSpeak && (
          <p className="why">This device has no voice. Ask someone to read this number aloud to you: {task.speak}</p>
        )}
        <div className="sheet">
          <InkCanvas
            key={task.id + (screen.review ? 'r' : 'w')}
            strokes={strokes}
            guide={task.guide}
            onChange={screen.review ? undefined : (s) => setInk({ ...ink, [task.id]: [...s] })}
            showInvisibleInk={screen.review}
          />
          {!screen.review && strokes.length === 0 && (
            <div className={'hint hint-' + (task.guide ?? 'write')} aria-hidden="true">
              {task.guide ? <span className="finger" /> : <span className="here">Write here with your finger</span>}
            </div>
          )}
        </div>
        {screen.review ? (
          <>
            <p className="legend">
              <span className="dot air" /> Orange is where your finger was off the screen. Bigger circles are longer
              pauses.
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
              onClick={() => (last ? afterShort() : setScreen({ name: 'task', index: screen.index + 1, review: false }))}
            >
              {last ? 'See the result' : 'Next'}
            </button>
          </>
        ) : (
          <div className="row">
            <button className="ghost" onClick={() => setInk({ ...ink, [task.id]: [] })} disabled={!strokes.length}>
              Start over
            </button>
            <button
              className="primary"
              onClick={() => {
                navigator.vibrate?.(15)
                setScreen({ ...screen, review: true })
              }}
              disabled={!strokes.length}
            >
              I'm done
            </button>
          </div>
        )}
      </main>
    )
  }

  if (screen.name === 'closer') {
    return (
      <main className="page" key="closer">
        <header className="brandbar">
          <span className="brand">Tinta</span>
        </header>
        <div className="poster">
          <Mascot mood="closer-look" size={220} />
        </div>
        <h1>Let me look a little closer</h1>
        <p className="lead">
          Your pattern sits between the two groups, so I would rather not guess. Three more short tasks, and I will ask
          two more models for a second opinion.
        </p>
        <div className="row push">
          <button className="ghost" onClick={() => setScreen({ name: 'result' })}>
            Stop here
          </button>
          <button
            className="primary"
            onClick={() => {
              setCloser(true)
              setScreen({ name: 'task', index: TASKS.length, review: false })
            }}
          >
            Three more
          </button>
        </div>
      </main>
    )
  }

  // Result: either the person's own writing or a held-out case from the study.
  const ex = example === null ? null : examples[example]
  const byTask: Record<number, Measures> = {}
  for (const id of [...WARMUP_IDS, ...TASK_IDS, ...EXTRA_IDS]) {
    byTask[id] = ex ? (ex.measures as Record<string, Measures>)[String(id)] : measure(ink[id] ?? [])
  }
  const first = predict(byTask)
  // The closer look is used when the short check was unsure and the three extra tasks were done.
  const hasExtra = ex ? true : closer && EXTRA_IDS.every((id) => (ink[id] ?? []).length > 0)
  const second = (isGrey(first) || (forceCloser && !ex)) && hasExtra ? predictCloser(byTask) : null
  const p = second ? second.p : first
  const v = VERDICTS[verdict(p)]
  const shown = second ? [...TASKS, ...EXTRA] : TASKS
  const adaptive = metrics.adaptive
  const same = metrics['1.0']
  const slow = metrics['1.5']
  const wrong = ex ? isWrong(ex) : false
  const nextWrong = () => {
    for (let k = 1; k <= examples.length; k++) {
      const i = ((example ?? -1) + k) % examples.length
      if (isWrong(examples[i])) return setExample(i)
    }
  }
  const studyLine = JSON.stringify({ age, score: Math.round(p * 100), tasks: byTask })
  return (
    <main className="page">
      <header className="taskbar">
        <Mascot mood={v.mood} size={110} />
        <p className="step">
          {ex ? `Real case ${example! + 1} of ${examples.length} · this person is actually ${ex.label}` : 'Your result'}
        </p>
      </header>
      <h1 className={'verdict ' + verdict(p)}>{v.title}</h1>
      <p className="lead">{v.body}</p>
      {ex && (
        <p className={'badge ' + (wrong ? 'bad' : 'good')}>
          {wrong ? 'Tinta gets this one wrong.' : 'Tinta gets this one right.'}
        </p>
      )}
      {ex && wrong && <p className="why">{whyWrong(ex.label, byTask)}</p>}
      {second && (
        <div className="votes">
          <p className="fine">
            {isGrey(first)
              ? `The short check was unsure (${Math.round(first * 100)}/100), so three models looked at all six tasks:`
              : `Demo mode: the short check was clear (${Math.round(first * 100)}/100), but here is the closer look anyway:`}
          </p>
          <ul>
            {second.votes.map((vote) => (
              <li key={vote.name}>
                <span>{vote.name}</span>
                <strong>{Math.round(vote.p * 100)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="meter" role="img" aria-label={`Model score ${Math.round(p * 100)} out of 100`}>
        <div className="meter-pin" style={{ left: `${Math.round(p * 100)}%` }} />
      </div>
      <p className="fine">
        Score {Math.round(p * 100)}/100. Under 35: usual pattern. Over 65: worth mentioning. In between: I don't know.
      </p>
      {!ex && (
        <section className="honest steps">
          <h2>What now?</h2>
          <ol>
            {NEXT_STEPS[verdict(p)].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      )}
      <details className="fold" open={Boolean(ex)}>
        <summary>See the measurements</summary>
      <table className="table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Slower than own warm-up</th>
            <th>In the air</th>
            <th>Touches</th>
          </tr>
        </thead>
        <tbody>
          {shown.filter((t) => !WARMUP_IDS.includes(t.id)).map((t) => (
            <tr key={t.id}>
              <td>{t.title}</td>
              <td>×{slowdown(byTask, t.id).toFixed(1)}</td>
              <td>{Math.round((100 * byTask[t.id].air_time) / Math.max(byTask[t.id].total_time, 1))}%</td>
              <td>{byTask[t.id].num_of_pendown}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </details>
      {ex && (
        <div className="row">
          <button className="ghost" onClick={() => setExample((example! + 1) % examples.length)}>
            Next case
          </button>
          <button className="ghost" onClick={nextWrong}>
            Show a mistake
          </button>
        </div>
      )}
      {!ex && (
        <section className="honest note">
          <h2>Note for the doctor</h2>
          <p>
            {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. A 2-minute
            writing check done at home on a phone, with a finger. Result: <strong>{v.title.toLowerCase()}</strong>{' '}
            (score {Math.round(p * 100)}/100{second ? ', after a closer look with three extra tasks' : ''}).
          </p>
          <p>
            Warm-up pace: {seconds(Math.exp(WARMUP_IDS.reduce((s, t) => s + Math.log(byTask[t].total_time), 0) / WARMUP_IDS.length))}{' '}
            per task. Against that pace, the circle took ×{slowdown(byTask, 5).toFixed(1)}, the loops ×
            {slowdown(byTask, 9).toFixed(1)} and the dictated phone number ×{slowdown(byTask, 23).toFixed(1)}.
          </p>
          <p>
            Tinta is a student prototype trained on the public DARWIN dataset (174 people). It is not a medical device
            and has not been validated with patients on phones. It is meant to start a conversation.
          </p>
          <button className="ghost noprint" onClick={() => window.print()}>
            Print or save as PDF
          </button>
        </section>
      )}
      {study && !ex && (
        <section className="honest">
          <h2>Study mode</h2>
          <p>Only timings are saved: no name, no drawing. Ask the person first.</p>
          <label className="field">
            Age band
            <select value={age} onChange={(e) => setAge(e.target.value)}>
              <option value="">Choose…</option>
              <option>under 30</option>
              <option>30 to 59</option>
              <option>60 or over</option>
            </select>
          </label>
          <textarea readOnly value={studyLine} rows={4} aria-label="Anonymous timings" />
          <button
            className="ghost"
            onClick={() => navigator.clipboard.writeText(studyLine).then(() => setCopied(true))}
          >
            {copied ? 'Copied' : 'Copy timings'}
          </button>
        </section>
      )}
      <details className="fold" open={Boolean(ex)}>
        <summary>How sure can you be? The honest numbers</summary>
      <section className="honest">
        <h2>How well does it work?</h2>
        <p>
          Trained on {counts.train} people, checked on {counts.test} it never saw ({same.model.patients} patients,{' '}
          {same.model.healthy} healthy). With the short check alone, Tinta missed {same.model.missed} patients and raised {same.model.false_alarms}{' '}
          false alarms. A plain stopwatch rule missed {same.stopwatch.missed} and raised {same.stopwatch.false_alarms}:
          on the study's own tablet, the stopwatch is slightly better.
        </p>
        <p>
          When the short check is unsure, Tinta asks for three more tasks and averages three models. With that closer
          look ({adaptive.closer_look} of the {counts.test} needed it), she missed {adaptive.missed} patients and raised{' '}
          {adaptive.false_alarms} false alarm{adaptive.false_alarms === 1 ? '' : 's'}, and still said "I can't tell" for{' '}
          {adaptive.still_unsure}.
        </p>
        <p>
          But a phone is not that tablet. If a device makes everyone 1.5 times slower, the stopwatch raises{' '}
          {slow.stopwatch.false_alarms} false alarms out of {slow.stopwatch.healthy} healthy people. Tinta still raises{' '}
          {slow.model.false_alarms}, because it compares you with your own warm-up, not with a clock.
        </p>
        <p>
          Limits: the study used a pen on a tablet, in Italian, and does not publish age or sex, so we cannot check
          that Tinta works equally well across groups. We have not tested it with patients on a phone. Treat a result
          as a reason to talk to a doctor, never as an answer.
        </p>
      </section>
      </details>
      <button className="primary" onClick={restart}>
        Start again
      </button>
      <p className="fine">This project is a prototype and is not medical advice.</p>
    </main>
  )
}
