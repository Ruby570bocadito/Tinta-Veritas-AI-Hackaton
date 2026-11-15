import { useEffect, useState, type CSSProperties } from 'react'
import History from './components/History'
import Playground from './components/Playground'
import Crowd from './components/Crowd'
import Demo from './components/Demo'
import InkCanvas, { type Guide, type Size } from './components/InkCanvas'
import Mascot, { type Mood } from './components/Mascot'
import { addToHistory, clearHistory, loadHistory, loadPeople, savePeople, type Entry } from './lib/history'
import { check, laps, les, turns } from './lib/check'
import { measure, seconds, stillTime, type Measures, type Stroke } from './lib/ink'
import { judge, score as scoreOf, wantsCloser, type Answer } from './lib/judge'
import { counts, examples, isGrey, crowd, metrics, airShare, onScale, typical, EXTRA_IDS, TASK_IDS, WARMUP_IDS, type Verdict } from './lib/model'
import { clearProgress, loadProgress, saveProgress } from './lib/resume'
import { initialLang, parts, plain, SOURCES, STRINGS, type Lang } from './lib/strings'
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

// Three more tasks (6, 10 and 18 of the original protocol), asked only when the short check is unsure.
// Short ones where people lift the pen: three letters, a word, and the name of an object in a picture.
// (The first version had two phone numbers here; volunteers found them long. ml/adaptive.py has both.)
const EXTRA: Task[] = [
  { id: 6, pose: 'task-copy' },
  { id: 10, pose: 'read' },
  { id: 18, pose: 'think', picture: 'obj-chair' },
]

// A check that was under way when the page was reloaded (a call, a pull on the screen, a tab thrown away by the
// browser): it comes back at the same step. Read once, before the first screen. See lib/resume.ts.
const kept = loadProgress([...TASKS, ...EXTRA].map((task) => task.id))

const NOTHING: Stroke[] = [] // one empty sheet for every task not written yet, so that an empty sheet never looks like a new one
const GUIDE_POSES: Mood[] = ['onb-pauses', 'onb-yourself', 'onb-private']
const VERDICT_MOOD: Record<Verdict, Mood> = { typical: 'jump', unsure: 'unsure', mention: 'caring' }
const LOCALE: Record<Lang, string> = { en: 'en-GB', es: 'es-ES' }

declare const __BUILD__: string // set by vite.config.ts: the minute this copy was built (UTC)

const params = new URLSearchParams(location.search)
const study = params.has('study')
const friends = params.has('friends') // invited testers: at the end they can send their result and opinion themselves
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
  | { name: 'play'; review: boolean } // the free sheet: write anything and see the invisible ink

export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang)
  const [screen, setScreen] = useState<Screen>(kept?.place ?? { name: 'intro' })
  const [ink, setInk] = useState<Record<number, Stroke[]>>(kept?.ink ?? {})
  const [sheets, setSheets] = useState<Record<number, Size>>(kept?.sheets ?? {}) // size of the sheet each task was written on
  const [example, setExample] = useState<number | null>(null)
  const [closer, setCloser] = useState(kept?.closer ?? false) // true once the person accepts the three extra tasks
  const [tries, setTries] = useState<Record<number, number>>(kept?.tries ?? {}) // how many times each task was done again
  const [warned, setWarned] = useState<Record<number, string>>(kept?.warned ?? {}) // tasks where Tinta said something was missing, and what
  const [redo, setRedo] = useState<number[]>(kept?.redo ?? []) // tasks being done again from the result screen, in order
  const [touched, setTouched] = useState('') // the task being written since the finger first touched its sheet: its example is gone
  const [doodle, setDoodle] = useState<Stroke[]>([]) // the free sheet: never scored, never saved
  const [doodleSheet, setDoodleSheet] = useState<Size>({ w: 360, h: 340 })
  const [history, setHistory] = useState<Entry[]>(loadHistory)
  const [replay, setReplay] = useState(0)
  const [age, setAge] = useState('')
  const [copied, setCopied] = useState(false)
  const [people, setPeople] = useState<string[]>(loadPeople) // study mode: volunteers saved on this phone
  const [justSaved, setJustSaved] = useState(false)
  const [who, setWho] = useState('')
  const [notes, setNotes] = useState('')
  const [sent, setSent] = useState<'no' | 'shared' | 'copied' | 'manual'>('no')
  const t = STRINGS[lang]
  const secs = (ms: number) => seconds(ms, lang)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem('tinta-lang', lang)
    } catch {
      // private mode: the choice simply is not remembered
    }
  }, [lang])

  // Each new screen starts from its first words: for someone using a screen reader or a keyboard, focus goes
  // to what Tinta says (or to the heading), instead of being lost when the button they pressed disappears.
  const review = (screen.name === 'task' || screen.name === 'play') && screen.review
  const step = screen.name === 'task' ? screen.index : screen.name === 'guide' ? screen.step : 0
  useEffect(() => {
    const first = document.querySelector<HTMLElement>('main .cheer, main h1, main h2')
    if (!first) return
    first.tabIndex = -1
    first.focus({ preventScroll: true })
  }, [screen.name, step, review, example])

  // In the middle of the check, a swipe back or a reload would throw the writing away: the browser asks first.
  const busy = screen.name === 'task' || screen.name === 'closer'
  useEffect(() => {
    if (!busy) return
    const ask = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', ask)
    return () => window.removeEventListener('beforeunload', ask)
  }, [busy])

  // The check is kept through a reload: saved when a task is finished and when the next one starts, not at
  // every stroke. While a task is being written nothing is saved, so a half-written task starts again.
  useEffect(() => {
    if (example !== null || (screen.name !== 'task' && screen.name !== 'closer' && screen.name !== 'result')) return clearProgress()
    const writing = screen.name === 'task' && !screen.review ? [...TASKS, ...EXTRA][screen.index].id : null
    if (writing !== null && (ink[writing] ?? []).length) return
    saveProgress({ place: screen, ink, sheets, closer, tries, warned, redo })
  }, [screen, ink, sheets, closer, tries, warned, redo, example])
  // True only until the first step forward: the screen the person came back to after a reload.
  const cameBack = kept !== null && screen === kept.place

  /** Go back to one task and do it again, keeping everything else that was written. */
  const doAgain = (id: number) => {
    const list = closer ? [...TASKS, ...EXTRA] : TASKS
    setInk((old) => ({ ...old, [id]: [] }))
    setTries((old) => ({ ...old, [id]: (old[id] ?? 0) + 1 }))
    setScreen({ name: 'task', index: list.findIndex((x) => x.id === id), review: false })
  }

  const restart = () => {
    setInk({})
    setTries({})
    setWarned({})
    setRedo([])
    setExample(null)
    setCopied(false)
    setJustSaved(false)
    setSent('no')
    setCloser(false)
    setScreen({ name: 'intro' })
  }

  const langButton = (
    <button className="link" onClick={() => setLang(lang === 'en' ? 'es' : 'en')} lang={lang === 'en' ? 'es' : 'en'}>
      {t.other}
    </button>
  )

  /** Finish the check: remember the score on this phone and show the result. */
  const finish = (withCloser: boolean) => {
    const a = judge(ink, sheets, withCloser, forceCloser)
    // A check with no result has no number, so it does not go on the "you against you" line.
    if (!a.noResult.length) setHistory(addToHistory({ t: Date.now(), score: onScale(a.p), verdict: a.kind, closer: Boolean(a.second) }))
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
          <Mascot mood="wave" size={170} label="Tinta" />
          <p className="bubble">{t.home.bubble}</p>
        </div>
        <h1>{t.home.title}</h1>
        <p className="lead">{t.home.lead}</p>
        <button className="primary" onClick={() => setScreen({ name: 'guide', step: 0 })}>
          {t.home.start}
        </button>
        <button className="ghost" onClick={() => setScreen({ name: 'play', review: false })}>
          ✎ {t.play.open}
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
        <p className="fine">
          {t.disclaimer} {t.private}
        </p>
        {/* Only shown by the styles to someone with a mouse: the fastest way from a computer to a phone.
            The code holds the address of the published app (made once with the qrcode package; make it again if the address changes). */}
        {!('TintaNative' in window) && (
          <aside className="handoff">
            <img src={`${import.meta.env.BASE_URL}img/qr.svg`} alt={t.home.handoff.alt} width={112} height={112} loading="lazy" />
            <p>
              <b>{t.home.handoff.title}</b> {t.home.handoff.body}
            </p>
          </aside>
        )}
        <ul className="chips">
          {t.home.chips.map((chip) => (
            <li key={chip}>{chip}</li>
          ))}
        </ul>
        <section className="how" aria-label={t.home.how}>
          <h2>{t.home.how}</h2>
          <ol>
            {t.home.steps.map((step, i) => (
              <li key={step}>
                <Mascot mood={(['task-loops', 'writing', 'closer-look'] as const)[i]} size={84} />
                <span>
                  <b>{i + 1}</b>
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </section>
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
        <Playground t={t} />
        {t.ask.items.map((item) => (
          <details className="fold qa" key={item.q}>
            <summary>{item.q}</summary>
            <div className="honest answer">
              {item.a.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {canSpeak && (
                <button className="link" aria-label={`${t.task.read}: ${item.q}`} onClick={() => say(item.a.join(' '), t.voice)}>
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

  // The free sheet. Ten seconds to see what the app is about: write anything, then watch the invisible ink.
  if (screen.name === 'play') {
    const m = measure(doodle)
    const leave = (to: Screen) => {
      setDoodle([])
      setScreen(to)
    }
    return (
      <main className="page" key={'play' + screen.review}>
        <header className="taskbar">
          <Mascot mood={screen.review ? 'writing' : 'finger-tap'} size={96} />
          <p className="step">{t.play.kicker}</p>
          <button className="link quit" onClick={() => leave({ name: 'intro' })}>
            {t.play.back}
          </button>
        </header>
        <h2>{screen.review ? t.task.inkTitle : t.play.title}</h2>
        {!screen.review && <p className="fine">{t.play.hint}</p>}
        {!screen.review && <p className="why rotate">{t.task.rotate}</p>}
        <div className="sheet">
          <InkCanvas
            key={screen.review ? 'r' + replay : 'w'}
            strokes={doodle}
            from={screen.review ? doodleSheet : undefined}
            onChange={
              screen.review
                ? undefined
                : (strokes, sheet) => {
                    setDoodle([...strokes])
                    setDoodleSheet(sheet)
                  }
            }
            showInvisibleInk={screen.review}
          />
          {!screen.review && doodle.length === 0 && (
            <div className="hint hint-write" aria-hidden="true">
              <span className="here">{t.task.writeHere}</span>
            </div>
          )}
        </div>
        {screen.review && (
          <p className="legend">
            <span className="dot air" /> {t.task.legend}{' '}
            <button className="link inline" onClick={() => setReplay(replay + 1)}>
              ↻ {t.task.again}
            </button>
          </p>
        )}
        {/* The three numbers move as you write: every lift adds a touch and some time in the air. */}
        <dl className="stats" aria-live="polite">
          <div>
            <dt>{t.task.air}</dt>
            <dd>{secs(m.air_time)}</dd>
          </div>
          <div>
            <dt>{t.task.screen}</dt>
            <dd>{secs(m.paper_time)}</dd>
          </div>
          <div>
            <dt>{t.task.touches}</dt>
            <dd>{m.num_of_pendown}</dd>
          </div>
        </dl>
        {screen.review ? (
          <div className="row sticky">
            <button className="ghost" onClick={() => leave({ name: 'play', review: false })}>
              {t.play.again}
            </button>
            <button className="primary" onClick={() => leave({ name: 'guide', step: 0 })}>
              {t.play.start}
            </button>
          </div>
        ) : (
          <div className="row sticky">
            <button className="ghost" onClick={() => setDoodle([])} disabled={!doodle.length}>
              {t.play.clear}
            </button>
            <button className="primary" onClick={() => setScreen({ name: 'play', review: true })} disabled={!doodle.length}>
              {t.play.show}
            </button>
          </div>
        )}
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
    const strokes = ink[task.id] ?? NOTHING
    const m = measure(strokes)
    const last = screen.index === list.length - 1
    // After the fifth task Tinta already has a first answer. If it is unsure, she asks for a closer look.
    const afterLast = () => {
      if (closer) return finish(true)
      if (wantsCloser(ink, sheets, forceCloser)) return setScreen({ name: 'closer' })
      finish(false)
    }
    // Coming from "no result": only the tasks that were missing are done again, then straight back to the result.
    const redoing = redo.length > 0
    const lastOne = redoing ? redo.length === 1 : last
    const goOn = () => {
      if (!redoing) return last ? afterLast() : setScreen({ name: 'task', index: screen.index + 1, review: false })
      const rest = redo.slice(1)
      setRedo(rest)
      return rest.length ? doAgain(rest[0]) : afterLast()
    }
    // Was the task done as asked? If clearly not, Tinta says what she saw and offers another go.
    const sheet = sheets[task.id] ?? { w: 360, h: 340 }
    const issue = screen.review ? check(task.id, strokes, sheet) : null
    const practice = WARMUP_IDS.includes(task.id)
    const attempt = `${task.id}:${tries[task.id] ?? 0}` // this go at this task
    const tryAgain = () => doAgain(task.id)
    return (
      <main className="page" key={'task' + screen.index + screen.review}>
        <header className="taskbar">
          <Mascot mood={screen.review ? (issue ? 'unsure' : 'writing') : task.pose} size={96} />
          <div>
            <ol className="dots" aria-hidden="true">
              {list.map((item, i) => (
                <li key={item.id} className={i < screen.index ? 'done' : i === screen.index ? 'now' : ''} />
              ))}
            </ol>
            <p className="step">{redoing ? t.check.redoing(text.title) : t.task.step(screen.index + 1, list.length, text.title)}</p>
            {/* After a reload in the middle of the check. Next to the step, where it takes no room from the sheet. */}
            {cameBack && (
              <p className="step back" role="status">
                {t.task.back}
              </p>
            )}
          </div>
          <button className="link quit" onClick={() => window.confirm(t.task.quitConfirm) && restart()}>
            {t.task.quit}
          </button>
        </header>
        {screen.review && (
          <p className="bubble cheer">
            {issue
              ? `${t.check.text(issue)}${practice ? ' ' + t.check.practice : ''}`
              : redoing
                ? t.check.redone
                : t.task.cheers[screen.index]}
          </p>
        )}
        {/* When Tinta has something to say about the task, her words are the heading. */}
        {!issue && (
          <h2>
            {screen.review ? t.task.inkTitle : parts(text.instruction).map((piece, i) => (piece.key ? <em key={i}>{piece.text}</em> : piece.text))}
          </h2>
        )}
        {/* What to copy (or the picture to name) and "read it to me" share one line: on a small phone every line saved goes to the sheet. */}
        {!screen.review && (text.prompt || task.picture || canSpeak) && (
          <div className="asked">
            {text.prompt && <p className="prompt">{text.prompt}</p>}
            {task.picture && <img className="picture" src={`${import.meta.env.BASE_URL}img/tinta-${task.picture}.webp`} alt="" width={84} height={84} />}
            {canSpeak && (
              <button className="link" onClick={() => say(plain(text.instruction), t.voice)}>
                ▶ {t.task.read}
              </button>
            )}
          </div>
        )}
        {/* Only shown by the styles when the phone is on its side and the sheet would be cramped. */}
        {!screen.review && <p className="why rotate">{t.task.rotate}</p>}
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
            onStart={() => setTouched(attempt)}
            showInvisibleInk={screen.review}
          />
          {/* Tinta does it first: the example plays on the empty sheet until the finger touches it. */}
          {!screen.review && strokes.length === 0 && touched !== attempt && <Demo task={task.id} prompt={text.prompt} example={t.task.exampleWord} tag={t.task.example} />}
        </div>
        {screen.review ? (
          <>
            <p className="legend">
              <span className="dot air" /> {t.task.legend}{' '}
              <button className="link inline" onClick={() => setReplay(replay + 1)}>
                ↻ {t.task.again}
              </button>
            </p>
            {/* What was measured is always shown. When Tinta has something to say, it goes in one line to leave room for her words. */}
            {issue ? (
              <p className="fine measured">
                {t.task.touches}: <b>{m.num_of_pendown}</b> · {t.task.air}: <b>{secs(m.air_time)}</b> · {t.task.screen}: <b>{secs(m.paper_time)}</b>
              </p>
            ) : (
              <dl className="stats">
                <div>
                  <dt>{t.task.air}</dt>
                  <dd>{secs(m.air_time)}</dd>
                </div>
                <div>
                  <dt>{t.task.screen}</dt>
                  <dd>{secs(m.paper_time)}</dd>
                </div>
                <div>
                  <dt>{t.task.touches}</dt>
                  <dd>{m.num_of_pendown}</dd>
                </div>
              </dl>
            )}
            {issue && practice ? (
              <div className="row sticky">
                <button className="ghost" onClick={goOn}>
                  {t.check.keep}
                </button>
                <button className="primary" onClick={tryAgain}>
                  {t.check.again}
                </button>
              </div>
            ) : issue ? (
              // A task that counts. Four of the first four people who were asked to write the word again pressed
              // "keep it" and left with no result, so doing it again is now the one big button, and leaving it is
              // a smaller choice that says what it costs.
              <div className="sticky stack">
                <button className="primary" onClick={tryAgain}>
                  {t.check.again}
                </button>
                <button className="link" onClick={goOn}>
                  {t.check.leave}
                </button>
              </div>
            ) : (
              <div className="row sticky">
                <button className="primary" onClick={goOn}>
                  {lastOne ? t.task.seeResult : t.task.next}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="row sticky">
            <button
              className="ghost"
              onClick={() => {
                setInk({ ...ink, [task.id]: [] })
                setTouched('') // an empty sheet again: the example comes back
              }}
              disabled={!strokes.length}
            >
              {t.task.startOver}
            </button>
            <button
              className="primary"
              onClick={() => {
                navigator.vibrate?.(15)
                const seen = check(task.id, strokes, sheet)
                if (seen) setWarned({ ...warned, [task.id]: seen.kind })
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
        {cameBack && (
          <p className="why" role="status">
            {t.task.back}
          </p>
        )}
        <p className="lead">{forceCloser && !isGrey(judge(ink, sheets, false).first) ? t.closer.demo : t.closer.body}</p>
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
  let answer: Answer
  if (ex) {
    const fromStudy: Record<number, Measures> = {}
    for (const id of [...WARMUP_IDS, ...TASK_IDS, ...EXTRA_IDS]) fromStudy[id] = (ex.measures as Record<string, Measures>)[String(id)]
    answer = { ...scoreOf(fromStudy, true), noResult: [] }
  } else {
    answer = judge(ink, sheets, closer, forceCloser)
  }
  const { byTask, first, second, p, kind } = answer
  // A scored task that cannot be compared with the study (not done, or no pause to time): no result is shown.
  const invalid = answer.noResult.length > 0
  const why = answer.noResult.map(({ id, issue }) => `${t.tasks[id].title}: ${t.check.text(issue)}`).join(' ')
  const v = t.verdicts[kind]
  const score = onScale(p)
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
  // Saved next to the timings, to learn how people really do the tasks on a phone: laps round the circle,
  // how many "le", turns in the word, tasks done again, tasks with no result, and how long the finger
  // rested on the glass without moving (a pause a phone cannot see as time in the air).
  const sheetOf = (id: number) => sheets[id] ?? { w: 360, h: 340 }
  const followed = {
    laps: Number(laps(ink[5] ?? []).toFixed(1)),
    les: Number(les(ink[9] ?? [], sheetOf(9)).toFixed(1)),
    turns: turns(ink[16] ?? [], sheetOf(16)),
    still: Object.fromEntries(TASK_IDS.map((id) => [id, stillTime(ink[id] ?? [])])),
    warned,
    tries,
    noResult: answer.noResult.map((n) => `${n.id}:${n.issue.kind}`),
  }
  // `v` is when this copy of the app was built, so that a line received days later says which version wrote it.
  const studyLine = JSON.stringify({ v: __BUILD__, age, lang, score, ...followed, tasks: byTask })
  // What an invited tester sends: a few readable lines, then the same timings as study mode. No drawing.
  const friendMessage = [
    t.friends.header,
    `${t.friends.nameLabel}: ${who.trim() || '-'}`,
    `${t.friends.result}: ${invalid ? t.result.noResultTitle : `${v.title} (${score}/100)`}`,
    `${t.friends.notesLabel}: ${notes.trim() || '-'}`,
    JSON.stringify({ v: __BUILD__, age, lang, score, verdict: kind, closer: Boolean(second), ...followed, screen: [window.innerWidth, window.innerHeight], tasks: byTask }),
  ].join('\n')
  const sendToFriend = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: friendMessage })
        return setSent('shared')
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return // the person closed the share sheet
    }
    try {
      await navigator.clipboard.writeText(friendMessage)
      setSent('copied')
    } catch {
      setSent('manual') // some in-app browsers allow neither sharing nor copying: the text is shown to copy by hand
    }
  }
  const today = new Date().toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <main className="page" key="result">
      <header className="taskbar">
        <Mascot mood={invalid ? 'shrug' : VERDICT_MOOD[kind]} size={130} />
        {!ex && kind === 'typical' && (
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 18 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        )}
        <p className="step">
          {ex ? t.result.realCase(example! + 1, examples.length, ex.label === 'patient' ? t.result.patient : t.result.healthy) : t.result.yours}
        </p>
      </header>
      <h1 className={'verdict ' + kind}>{invalid ? t.result.noResultTitle : v.title}</h1>
      {invalid ? (
        <>
          <p className="lead">{t.result.noResult(answer.noResult.length)}</p>
          <ul className="issues">
            {answer.noResult.map(({ id, issue }) => (
              <li key={id}>
                <b>{t.tasks[id].title}.</b> {t.check.text(issue)}
              </li>
            ))}
          </ul>
          {answer.noResult.some((n) => n.issue.kind === 'joined') && <p className="why">{t.result.joinedWhy}</p>}
          {/* Nothing else is lost: only the tasks listed above are done again, then the result. */}
          <button
            className="primary"
            onClick={() => {
              const order = (closer ? [...TASKS, ...EXTRA] : TASKS).map((x) => x.id).filter((id) => answer.noResult.some((n) => n.id === id))
              setRedo(order)
              doAgain(order[0])
            }}
          >
            {t.result.redo(answer.noResult.length)}
          </button>
          {answer.noResult.some((n) => n.issue.kind !== 'joined') && <p className="why">{t.result.notAskedHard}</p>}
        </>
      ) : (
        <>
          <p className="lead">{v.body}</p>
          {/* The person's own two measures next to the healthy group's, so the answer is not just a sentence. */}
          {!ex && <p className="fine">{t.note.detail(meanAir, usual[0], meanTouches, usual[1])}</p>}
        </>
      )}
      {ex && (
        <p className={'badge ' + (judged === 'wrong' ? 'bad' : judged === 'right' ? 'good' : 'none')}>
          {judged === 'wrong' ? t.result.wrong : judged === 'right' ? t.result.right : t.result.noAnswer}
        </p>
      )}
      {ex && wrong && <p className="why">{whyWrong()}</p>}
      {second && !invalid && (
        <div className="votes">
          <p className="fine">{isGrey(first) ? t.result.votesUnsure(onScale(first)) : t.result.votesDemo(onScale(first))}</p>
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
      {!invalid && (
        <>
          <div className="meter" role="img" aria-label={`${score}/100`}>
            <div className="meter-pin" key={score} style={{ left: `${score}%`, '--to': `${score}%` } as CSSProperties} />
          </div>
          <p className="fine">{t.result.score(score)}</p>
        </>
      )}
      {/* With no result there is no number to put a warning on. */}
      {!invalid && <p className="fine caveat">{t.result.caveat}</p>}
      {friends && !ex && (
        <section className="honest noprint">
          <h2>{t.friends.title}</h2>
          <p>{t.friends.body}</p>
          <label className="field">
            {t.friends.name}
            <input type="text" value={who} maxLength={40} autoComplete="off" onChange={(e) => setWho(e.target.value)} />
          </label>
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
          <label className="field">
            {t.friends.notes}
            <textarea className="words" value={notes} rows={3} maxLength={600} placeholder={t.friends.notesHint} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <details className="fold">
            <summary>{t.friends.preview}</summary>
            <textarea readOnly value={friendMessage} rows={8} />
          </details>
          <button className="primary" onClick={sendToFriend}>
            {sent === 'shared' ? t.friends.sent : t.friends.send}
          </button>
          {sent === 'copied' && <p className="fine">{t.friends.copied}</p>}
          {sent === 'manual' && (
            <>
              <p className="why">{t.friends.manual}</p>
              <textarea readOnly value={friendMessage} rows={8} onFocus={(e) => e.currentTarget.select()} />
            </>
          )}
        </section>
      )}
      <section className="honest" hidden={invalid}>
        <h2>{ex ? t.crowd.caseTitle : t.crowd.title}</h2>
        <Crowd
          healthy={crowd.healthy}
          patients={crowd.patients}
          you={onScale(first)}
          label={ex ? '▼' : t.crowd.you}
          aria={t.crowd.aria(onScale(first))}
        />
        <p>{t.crowd.explain(crowd.healthy.length, crowd.patients.length)}</p>
      </section>
      {!ex && !invalid && (
        <section className="honest steps">
          <h2>{t.result.whatNow}</h2>
          <ol>
            {t.nextSteps[kind].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      )}
      {!ex && !invalid && history.length > 0 && (
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
      {/* With no result, what was measured is shown open: the lifts and pauses were still counted. */}
      <details className="fold" open={Boolean(ex) || invalid}>
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
          <p>{invalid ? t.note.noResult(today, why) : t.note.line(today, v.title, score, Boolean(second))}</p>
          {!invalid && <p>{t.note.detail(meanAir, usual[0], meanTouches, usual[1])}</p>}
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
          <button className="ghost" onClick={() => navigator.clipboard.writeText(studyLine).then(() => setCopied(true), () => setCopied(false))}>
            {copied ? t.study.copied : t.study.copy}
          </button>
          <button
            className="primary"
            disabled={justSaved}
            onClick={() => {
              const list = [...people, studyLine]
              savePeople(list)
              setPeople(list)
              setJustSaved(true)
            }}
          >
            {justSaved ? t.study.saved(people.length) : t.study.save}
          </button>
          {people.length > 0 && (
            <>
              <button className="ghost" onClick={() => navigator.clipboard.writeText(people.join('\n')).then(() => setCopied(true), () => setCopied(false))}>
                {t.study.copyAll(people.length)}
              </button>
              <button
                className="link left"
                onClick={() => {
                  if (!window.confirm(t.study.clearConfirm)) return
                  savePeople([])
                  setPeople([])
                  setJustSaved(false)
                }}
              >
                {t.study.clear}
              </button>
            </>
          )}
        </section>
      )}
      <details className="fold" open={Boolean(ex)}>
        <summary>{t.honest.summary}</summary>
        <section className="honest">
          <div className="lab-head">
            <Mascot mood="stopwatch-sad" size={84} />
            <h2>{t.honest.title}</h2>
          </div>
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
