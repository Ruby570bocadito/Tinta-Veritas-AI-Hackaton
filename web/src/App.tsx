import { useEffect, useState } from 'react'
import History from './components/History'
import InkCanvas, { type Guide, type Size } from './components/InkCanvas'
import Mascot, { type Mood } from './components/Mascot'
import { addToHistory, clearHistory, loadHistory, type Entry } from './lib/history'
import { measure, seconds, type Measures, type Stroke } from './lib/ink'
import {
  counts,
  examples,
  isGrey,
  metrics,
  predict,
  predictCloser,
  airShare,
  typical,
  verdict,
  EXTRA_IDS,
  TASK_IDS,
  WARMUP_IDS,
  type Verdict,
} from './lib/model'
import { initialLang, SOURCES, STRINGS, type Lang } from './lib/strings'
import { canSpeak, say } from './lib/voice'

type Task = { id: number; pose: Mood; guide?: Guide; picture?: string }

// Tasks from the DARWIN protocol (numbers are the original task numbers).
// 2 and 3 are practice, to get used to the screen: they are not scored. 5, 9 and 16 are scored.
const TASKS: Task[] = [
  { id: 2, pose: 'task-warmup', guide: 'hline' },
  { id: 3, pose: 'task-lines', guide: 'vline' },
  { id: 5, pose: 'task-circle', guide: 'circle' },
  { id: 9, pose: 'task-loops' },
  { id: 16, pose: 'task-reverse' },
]

// Three more tasks (6, 22 and 23 of the original protocol), asked only when the short check is unsure.
const EXTRA: Task[] = [
  { id: 6, pose: 'task-copy' },
  { id: 22, pose: 'watching' },
  { id: 23, pose: 'task-phone' },
]

const GUIDE_POSES: Mood[] = ['onb-pauses', 'onb-yourself', 'onb-private']
const VERDICT_MOOD: Record<Verdict, Mood> = { typical: 'happy', unsure: 'unsure', mention: 'caring' }
const LOCALE: Record<Lang, string> = { en: 'en-GB', es: 'es-ES' }

const params = new URLSearchParams(location.search)
const study = params.has('study')
// For demos: ?closer always shows the closer look, whatever the first score is.
const forceCloser = params.has('closer')
// A real case is judged by what the app would actually tell that person, not by a 50/50 cut.
type Outcome = 'right' | 'wrong' | 'none'
const outcome = (e: (typeof examples)[number]): Outcome =>
  e.told === 'unsure' ? 'none' : (e.told === 'mention') === (e.label === 'patient') ? 'right' : 'wrong'
const isWrong = (e: (typeof examples)[number]) => outcome(e) === 'wrong'

type Screen =
  | { name: 'intro' }
  | { name: 'guide'; step: number }
  | { name: 'ready' }
  | { name: 'task'; index: number; review: boolean }
  | { name: 'closer' }
  | { name: 'result' }
  | { name: 'ask' }

export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang)
  const [screen, setScreen] = useState<Screen>({ name: 'intro' })
  const [ink, setInk] = useState<Record<number, Stroke[]>>({})
  const [sheets, setSheets] = useState<Record<number, Size>>({}) // size of the sheet each task was written on
  const [example, setExample] = useState<number | null>(null)
  const [closer, setCloser] = useState(false) // true once the person accepts the three extra tasks
  const [history, setHistory] = useState<Entry[]>(loadHistory)
  const [replay, setReplay] = useState(0)
  const [age, setAge] = useState('')
  const [copied, setCopied] = useState(false)
  const t = STRINGS[lang]

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem('tinta-lang', lang)
    } catch {
      // private mode: the choice simply is not remembered
    }
  }, [lang])

  const restart = () => {
    setInk({})
    setExample(null)
    setCopied(false)
    setCloser(false)
    setScreen({ name: 'intro' })
  }

  const langButton = (
    <button className="link" onClick={() => setLang(lang === 'en' ? 'es' : 'en')} lang={lang === 'en' ? 'es' : 'en'}>
      {t.other}
    </button>
  )

  /** Everything measured so far, by task number. */
  const measured = () => {
    const byTask: Record<number, Measures> = {}
    for (const id of [...WARMUP_IDS, ...TASK_IDS, ...EXTRA_IDS]) byTask[id] = measure(ink[id] ?? [])
    return byTask
  }

  /** The person's own answer: stage 1, or the closer look if it was needed and done. */
  const ownAnswer = (withCloser: boolean) => {
    const byTask = measured()
    const first = predict(byTask)
    const hasExtra = withCloser && EXTRA_IDS.every((id) => (ink[id] ?? []).length > 0)
    const second = (isGrey(first) || forceCloser) && hasExtra ? predictCloser(byTask) : null
    return { byTask, first, second, p: second ? second.p : first }
  }

  /** Finish the check: remember the score on this phone and show the result. */
  const finish = (withCloser: boolean) => {
    const { p, second } = ownAnswer(withCloser)
    setHistory(addToHistory({ t: Date.now(), score: Math.round(p * 100), verdict: second?.split ? 'unsure' : verdict(p), closer: Boolean(second) }))
    setScreen({ name: 'result' })
  }

  if (screen.name === 'intro') {
    return (
      <main className="page intro" key="intro">
        <header className="brandbar">
          <span className="brand">Tinta</span>
          <span className="tag">{t.prototype}</span>
          {langButton}
        </header>
        <div className="hero">
          <Mascot mood="hello" size={170} label="Tinta" />
          <p className="bubble">{t.home.bubble}</p>
        </div>
        <h1>{t.home.title}</h1>
        <p className="lead">{t.home.lead}</p>
        <button className="primary" onClick={() => setScreen({ name: 'guide', step: 0 })}>
          {t.home.start}
        </button>
        <div className="row">
          <button
            className="ghost"
            onClick={() => {
              setExample(0)
              setScreen({ name: 'result' })
            }}
          >
            {t.home.cases}
          </button>
          <button className="ghost" onClick={() => setScreen({ name: 'ask' })}>
            {t.home.ask}
          </button>
        </div>
        <ul className="chips">
          {t.home.chips.map((chip) => (
            <li key={chip}>{chip}</li>
          ))}
        </ul>
        <p className="fine">
          {t.disclaimer} {t.private}
        </p>
      </main>
    )
  }

  if (screen.name === 'ask') {
    return (
      <main className="page" key="ask">
        <header className="brandbar">
          <span className="brand">Tinta</span>
          {langButton}
        </header>
        <div className="hero">
          <Mascot mood="read" size={130} />
          <div>
            <h1>{t.ask.title}</h1>
          </div>
        </div>
        <p className="lead">{t.ask.lead}</p>
        {t.ask.items.map((item) => (
          <details className="fold qa" key={item.q}>
            <summary>{item.q}</summary>
            <div className="honest answer">
              {item.a.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {canSpeak && (
                <button className="link" onClick={() => say(item.a.join(' '), t.voice)}>
                  ▶ {t.task.read}
                </button>
              )}
            </div>
          </details>
        ))}
        <section className="honest">
          <h2>{t.ask.sources}</h2>
          <ul className="sources">
            {SOURCES.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.name}
                </a>
              </li>
            ))}
          </ul>
          <p>{t.disclaimer}</p>
        </section>
        <button className="primary" onClick={() => setScreen({ name: 'intro' })}>
          {t.ask.back}
        </button>
      </main>
    )
  }

  if (screen.name === 'guide') {
    const card = t.guide.cards[screen.step]
    const lastCard = screen.step === t.guide.cards.length - 1
    return (
      <main className="page" key={'guide' + screen.step}>
        <header className="brandbar">
          <span className="brand">Tinta</span>
          <button className="link" onClick={() => setScreen({ name: 'ready' })}>
            {t.guide.skip}
          </button>
        </header>
        <div className="poster">
          <Mascot mood={GUIDE_POSES[screen.step]} size={230} />
        </div>
        <ol className="dots center" aria-hidden="true">
          {t.guide.cards.map((g, i) => (
            <li key={g.title} className={i < screen.step ? 'done' : i === screen.step ? 'now' : ''} />
          ))}
        </ol>
        <h1>{card.title}</h1>
        <p className="lead">{card.body}</p>
        {canSpeak && (
          <button className="link left" onClick={() => say(`${card.title}. ${card.body}`, t.voice)}>
            ▶ {t.task.read}
          </button>
        )}
        <div className="row push sticky">
          <button
            className="ghost"
            onClick={() => setScreen(screen.step ? { name: 'guide', step: screen.step - 1 } : { name: 'intro' })}
          >
            {t.guide.back}
          </button>
          <button
            className="primary"
            onClick={() => setScreen(lastCard ? { name: 'ready' } : { name: 'guide', step: screen.step + 1 })}
          >
            {lastCard ? t.guide.gotIt : t.guide.next}
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
        <h1>{t.ready.title}</h1>
        <ul className="tips">
          {t.ready.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
        <p className="lead">{t.ready.lead}</p>
        <div className="row push sticky">
          <button className="ghost" onClick={() => setScreen({ name: 'guide', step: t.guide.cards.length - 1 })}>
            {t.guide.back}
          </button>
          <button className="primary" onClick={() => setScreen({ name: 'task', index: 0, review: false })}>
            {t.ready.begin}
          </button>
        </div>
      </main>
    )
  }

  if (screen.name === 'task') {
    const list = closer ? [...TASKS, ...EXTRA] : TASKS
    const task = list[screen.index]
    const text = t.tasks[task.id]
    const strokes = ink[task.id] ?? []
    const m = measure(strokes)
    const last = screen.index === list.length - 1
    // After the fifth task Tinta already has a first answer. If it is unsure, she asks for a closer look.
    const afterLast = () => {
      if (closer) return finish(true)
      if (forceCloser || isGrey(predict(measured()))) return setScreen({ name: 'closer' })
      finish(false)
    }
    return (
      <main className="page" key={'task' + screen.index + screen.review}>
        <header className="taskbar">
          <Mascot mood={screen.review ? 'writing' : task.pose} size={96} />
          <div>
            <ol className="dots" aria-hidden="true">
              {list.map((item, i) => (
                <li key={item.id} className={i < screen.index ? 'done' : i === screen.index ? 'now' : ''} />
              ))}
            </ol>
            <p className="step">{t.task.step(screen.index + 1, list.length, text.title)}</p>
          </div>
          <button className="link quit" onClick={() => window.confirm(t.task.quitConfirm) && restart()}>
            {t.task.quit}
          </button>
        </header>
        {screen.review && <p className="bubble cheer">{t.task.cheers[screen.index]}</p>}
        <h2>{screen.review ? t.task.inkTitle : text.instruction}</h2>
        {!screen.review && canSpeak && !text.speak && (
          <button className="link left" onClick={() => say(text.instruction, t.voice)}>
            ▶ {t.task.read}
          </button>
        )}
        {text.prompt && !screen.review && <p className="prompt">{text.prompt}</p>}
        {task.picture && !screen.review && (
          <img className="picture" src={`${import.meta.env.BASE_URL}img/tinta-${task.picture}.webp`} alt="" width={150} height={150} />
        )}
        {text.speak && !screen.review && canSpeak && (
          <button className="ghost" onClick={() => say(text.speak!, t.voice)}>
            ▶ {t.task.listen}
          </button>
        )}
        {text.speak && !screen.review && !canSpeak && <p className="why">{t.task.noVoice(text.speak)}</p>}
        <div className="sheet">
          <InkCanvas
            key={task.id + (screen.review ? 'r' + replay : 'w')}
            strokes={strokes}
            guide={task.guide}
            from={screen.review ? sheets[task.id] : undefined}
            onChange={
              screen.review
                ? undefined
                : (s, sheet) => {
                    setInk({ ...ink, [task.id]: [...s] })
                    setSheets({ ...sheets, [task.id]: sheet })
                  }
            }
            showInvisibleInk={screen.review}
          />
          {!screen.review && strokes.length === 0 && (
            <div className={'hint hint-' + (task.guide ?? 'write')} aria-hidden="true">
              {task.guide ? <span className="finger" /> : <span className="here">{t.task.writeHere}</span>}
            </div>
          )}
        </div>
        {screen.review ? (
          <>
            <p className="legend">
              <span className="dot air" /> {t.task.legend}{' '}
              <button className="link inline" onClick={() => setReplay(replay + 1)}>
                ↻ {t.task.again}
              </button>
            </p>
            <dl className="stats">
              <div>
                <dt>{t.task.air}</dt>
                <dd>{seconds(m.air_time)}</dd>
              </div>
              <div>
                <dt>{t.task.screen}</dt>
                <dd>{seconds(m.paper_time)}</dd>
              </div>
              <div>
                <dt>{t.task.touches}</dt>
                <dd>{m.num_of_pendown}</dd>
              </div>
            </dl>
            <button
              className="primary sticky"
              onClick={() => (last ? afterLast() : setScreen({ name: 'task', index: screen.index + 1, review: false }))}
            >
              {last ? t.task.seeResult : t.task.next}
            </button>
          </>
        ) : (
          <div className="row sticky">
            <button className="ghost" onClick={() => setInk({ ...ink, [task.id]: [] })} disabled={!strokes.length}>
              {t.task.startOver}
            </button>
            <button
              className="primary"
              onClick={() => {
                navigator.vibrate?.(15)
                setScreen({ ...screen, review: true })
              }}
              disabled={!strokes.length}
            >
              {t.task.done}
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
        <h1>{t.closer.title}</h1>
        <p className="lead">{t.closer.body}</p>
        <div className="row push sticky">
          <button className="ghost" onClick={() => finish(false)}>
            {t.closer.stop}
          </button>
          <button
            className="primary"
            onClick={() => {
              setCloser(true)
              setScreen({ name: 'task', index: TASKS.length, review: false })
            }}
          >
            {t.closer.more}
          </button>
        </div>
      </main>
    )
  }

  // Result: either the person's own writing or a held-out case from the study.
  const ex = example === null ? null : examples[example]
  let byTask: Record<number, Measures>
  let first: number
  let second: ReturnType<typeof predictCloser> | null
  if (ex) {
    byTask = {}
    for (const id of [...WARMUP_IDS, ...TASK_IDS, ...EXTRA_IDS]) byTask[id] = (ex.measures as Record<string, Measures>)[String(id)]
    first = predict(byTask)
    second = isGrey(first) ? predictCloser(byTask) : null
  } else {
    ;({ byTask, first, second } = ownAnswer(closer))
  }
  const p = second ? second.p : first
  const kind: Verdict = second?.split ? 'unsure' : verdict(p)
  const v = t.verdicts[kind]
  const score = Math.round(p * 100)
  const shown = second ? [...TASKS, ...EXTRA] : TASKS
  const judged: Outcome | null = ex ? outcome(ex) : null
  const wrong = judged === 'wrong'
  const nextWrong = () => {
    for (let k = 1; k <= examples.length; k++) {
      const i = ((example ?? -1) + k) % examples.length
      if (isWrong(examples[i])) return setExample(i)
    }
  }
  // Averages over the three scored tasks, for the note in plain words.
  const scored = TASK_IDS.map((id) => byTask[id])
  const meanAir = Math.round((100 * scored.reduce((s, m) => s + airShare(m), 0)) / scored.length)
  const meanTouches = Math.round(scored.reduce((s, m) => s + m.num_of_pendown, 0) / scored.length)
  const usual = [Math.round(100 * typical.air), Math.round(typical.touches)] as const
  // Why a real case went wrong, from that person's own measures.
  const whyWrong = () => (ex!.label === 'patient' ? t.why.missed : t.why.falseAlarm)(meanAir, usual[0], meanTouches, usual[1])
  const studyLine = JSON.stringify({ age, lang, score, tasks: byTask })
  const today = new Date().toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <main className="page" key="result">
      <header className="taskbar">
        <Mascot mood={VERDICT_MOOD[kind]} size={110} />
        <p className="step">
          {ex ? t.result.realCase(example! + 1, examples.length, ex.label === 'patient' ? t.result.patient : t.result.healthy) : t.result.yours}
        </p>
      </header>
      <h1 className={'verdict ' + kind}>{v.title}</h1>
      <p className="lead">{v.body}</p>
      {ex && (
        <p className={'badge ' + (judged === 'wrong' ? 'bad' : judged === 'right' ? 'good' : 'none')}>
          {judged === 'wrong' ? t.result.wrong : judged === 'right' ? t.result.right : t.result.noAnswer}
        </p>
      )}
      {ex && wrong && <p className="why">{whyWrong()}</p>}
      {second && (
        <div className="votes">
          <p className="fine">{isGrey(first) ? t.result.votesUnsure(Math.round(first * 100)) : t.result.votesDemo(Math.round(first * 100))}</p>
          <ul>
            {second.votes.map((vote, i) => (
              <li key={vote.name}>
                <span>{t.result.models[i]}</span>
                <strong>{Math.round(vote.p * 100)}</strong>
              </li>
            ))}
          </ul>
          {second.split && <p className="why">{t.result.split}</p>}
        </div>
      )}
      <div className="meter" role="img" aria-label={`${score}/100`}>
        <div className="meter-pin" style={{ left: `${score}%` }} />
      </div>
      <p className="fine">{t.result.score(score)}</p>
      <p className="fine caveat">{t.result.caveat}</p>
      {!ex && (
        <section className="honest steps">
          <h2>{t.result.whatNow}</h2>
          <ol>
            {t.nextSteps[kind].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      )}
      {!ex && history.length > 0 && (
        <section className="honest">
          <h2>{t.history.title}</h2>
          <History entries={history} locale={LOCALE[lang]} />
          <p>{history.length === 1 ? t.history.first : t.history.many(history.length, history[history.length - 2].score)}</p>
          <p>{t.history.explain}</p>
          <button
            className="link left"
            onClick={() => {
              if (!window.confirm(t.history.clearConfirm)) return
              clearHistory()
              setHistory([])
            }}
          >
            {t.history.clear}
          </button>
        </section>
      )}
      <details className="fold" open={Boolean(ex)}>
        <summary>{t.result.measurements}</summary>
        <table className="table">
          <thead>
            <tr>
              <th>{t.result.colTask}</th>
              <th>{t.result.colAir}</th>
              <th>{t.result.colTouches}</th>
            </tr>
          </thead>
          <tbody>
            {shown
              .filter((task) => !WARMUP_IDS.includes(task.id))
              .map((task) => (
                <tr key={task.id}>
                  <td>{t.tasks[task.id].title}</td>
                  <td>{Math.round(100 * airShare(byTask[task.id]))}%</td>
                  <td>{byTask[task.id].num_of_pendown}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
      {ex && (
        <div className="row">
          <button className="ghost" onClick={() => setExample((example! + 1) % examples.length)}>
            {t.result.nextCase}
          </button>
          <button className="ghost" onClick={nextWrong}>
            {t.result.mistake}
          </button>
        </div>
      )}
      {!ex && (
        <section className="honest note">
          <h2>{t.note.title}</h2>
          <p>{t.note.line(today, v.title.toLowerCase(), score, Boolean(second))}</p>
          <p>{t.note.detail(meanAir, usual[0], meanTouches, usual[1])}</p>
          <p>{t.note.about}</p>
          <button className="ghost noprint" onClick={() => window.print()}>
            {t.note.print}
          </button>
        </section>
      )}
      {study && !ex && (
        <section className="honest">
          <h2>{t.study.title}</h2>
          <p>{t.study.body}</p>
          <label className="field">
            {t.study.age}
            <select value={age} onChange={(e) => setAge(e.target.value)}>
              <option value="">{t.study.choose}</option>
              {t.study.bands.map((band, i) => (
                <option key={band} value={['under 30', '30 to 59', '60 or over'][i]}>
                  {band}
                </option>
              ))}
            </select>
          </label>
          <textarea readOnly value={studyLine} rows={4} />
          <button className="ghost" onClick={() => navigator.clipboard.writeText(studyLine).then(() => setCopied(true))}>
            {copied ? t.study.copied : t.study.copy}
          </button>
        </section>
      )}
      <details className="fold" open={Boolean(ex)}>
        <summary>{t.honest.summary}</summary>
        <section className="honest">
          <h2>{t.honest.title}</h2>
          <p>{t.honest.short(metrics['1.0'].model, metrics['1.0'].stopwatch, counts.train, counts.test)}</p>
          <p>{t.honest.closer(metrics.adaptive, counts.test)}</p>
          <p>{t.honest.told(metrics.told.patients, metrics.told.healthy)}</p>
          <p>{t.honest.device(metrics['1.5'].stopwatch, metrics['1.5'].model)}</p>
          <p>{t.honest.uneven(metrics.pauses2, metrics.screen2)}</p>
          <p>{t.honest.limits}</p>
        </section>
      </details>
      <button className="primary" onClick={restart}>
        {ex ? t.result.home : t.result.restart}
      </button>
      <p className="fine">{t.disclaimer}</p>
    </main>
  )
}
