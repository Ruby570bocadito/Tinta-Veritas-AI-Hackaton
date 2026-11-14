import { useEffect, useState, type CSSProperties } from 'react'
import History from './components/History'
import Crowd from './components/Crowd'
import InkCanvas, { type Guide, type Size } from './components/InkCanvas'
import Mascot, { type Mood } from './components/Mascot'
import { addToHistory, clearHistory, loadHistory, loadPeople, savePeople, type Entry } from './lib/history'
import { check, laps, les, turns } from './lib/check'
import { measure, seconds, stillTime, type Measures, type Stroke } from './lib/ink'
import { judge, score as scoreOf, wantsCloser, type Answer } from './lib/judge'
import { counts, examples, isGrey, crowd, metrics, airShare, typical, EXTRA_IDS, TASK_IDS, WARMUP_IDS, type Verdict } from './lib/model'
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

export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang)
  const [screen, setScreen] = useState<Screen>({ name: 'intro' })
  const [ink, setInk] = useState<Record<number, Stroke[]>>({})
  const [sheets, setSheets] = useState<Record<number, Size>>({}) // size of the sheet each task was written on
  const [example, setExample] = useState<number | null>(null)
  const [closer, setCloser] = useState(false) // true once the person accepts the three extra tasks
  const [tries, setTries] = useState<Record<number, number>>({}) // how many times each task was done again
  const [history, setHistory] = useState<Entry[]>(loadHistory)
  const [replay, setReplay] = useState(0)
  const [age, setAge] = useState('')
  const [copied, setCopied] = useState(false)
  const [people, setPeople] = useState<string[]>(loadPeople) // study mode: volunteers saved on this phone
  const [justSaved, setJustSaved] = useState(false)
  const [who, setWho] = useState('')
  const [notes, setNotes] = useState('')
  const [sent, setSent] = useState<'no' | 'shared' | 'copied'>('no')
  const t = STRINGS[lang]

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
  const review = screen.name === 'task' && screen.review
  const step = screen.name === 'task' ? screen.index : screen.name === 'guide' ? screen.step : 0
  useEffect(() => {
    const first = document.querySelector<HTMLElement>('main .cheer, main h1, main h2')
    if (!first) return
    first.tabIndex = -1
    first.focus({ preventScroll: true })
  }, [screen.name, step, review, example])

  const restart = () => {
    setInk({})
    setTries({})
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
    if (!a.noResult.length) setHistory(addToHistory({ t: Date.now(), score: Math.round(a.p * 100), verdict: a.kind, closer: Boolean(a.second) }))
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
        <p className="fine">
          {t.disclaimer} {t.private}
        </p>
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
      if (wantsCloser(ink, sheets, forceCloser)) return setScreen({ name: 'closer' })
      finish(false)
    }
    const goOn = () => (last ? afterLast() : setScreen({ name: 'task', index: screen.index + 1, review: false }))
    // Was the task done as asked? If clearly not, Tinta says what she saw and offers another go.
    const issue = screen.review ? check(task.id, strokes, sheets[task.id] ?? { w: 360, h: 340 }) : null
    const tryAgain = () => {
      setInk({ ...ink, [task.id]: [] })
      setTries({ ...tries, [task.id]: (tries[task.id] ?? 0) + 1 })
      setScreen({ ...screen, review: false })
    }
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
            <p className="step">{t.task.step(screen.index + 1, list.length, text.title)}</p>
          </div>
          <button className="link quit" onClick={() => window.confirm(t.task.quitConfirm) && restart()}>
            {t.task.quit}
          </button>
        </header>
        {screen.review && (
          <p className="bubble cheer">
            {issue ? `${t.check.text(issue)} ${WARMUP_IDS.includes(task.id) ? t.check.practice : t.check.scored}` : t.task.cheers[screen.index]}
          </p>
        )}
        {/* When Tinta has something to say about the task, her words are the heading. */}
        {!issue && <h2>{screen.review ? t.task.inkTitle : text.instruction}</h2>}
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
            {!issue && (
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
            )}
            {issue ? (
              <div className="row sticky">
                <button className="ghost" onClick={goOn}>
                  {t.check.keep}
                </button>
                <button className="primary" onClick={tryAgain}>
                  {t.check.again}
                </button>
              </div>
            ) : (
              <button className="primary sticky" onClick={goOn}>
                {last ? t.task.seeResult : t.task.next}
              </button>
            )}
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
  // Saved next to the timings, to learn how people really do the tasks on a phone: laps round the circle,
  // how many "le", turns in the word, tasks done again, tasks with no result, and how long the finger
  // rested on the glass without moving (a pause a phone cannot see as time in the air).
  const sheetOf = (id: number) => sheets[id] ?? { w: 360, h: 340 }
  const followed = {
    laps: Number(laps(ink[5] ?? []).toFixed(1)),
    les: Number(les(ink[9] ?? [], sheetOf(9)).toFixed(1)),
    turns: turns(ink[16] ?? [], sheetOf(16)),
    still: Object.fromEntries(TASK_IDS.map((id) => [id, stillTime(ink[id] ?? [])])),
    tries,
    noResult: answer.noResult.map((n) => `${n.id}:${n.issue.kind}`),
  }
  const studyLine = JSON.stringify({ age, lang, score, ...followed, tasks: byTask })
  // What an invited tester sends: a few readable lines, then the same timings as study mode. No drawing.
  const friendMessage = [
    t.friends.header,
    `${t.friends.nameLabel}: ${who.trim() || '-'}`,
    `${t.friends.result}: ${v.title}${invalid ? '' : ` (${score}/100)`}`,
    `${t.friends.notesLabel}: ${notes.trim() || '-'}`,
    JSON.stringify({ age, lang, score, verdict: kind, closer: Boolean(second), ...followed, screen: [window.innerWidth, window.innerHeight], tasks: byTask }),
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
    await navigator.clipboard.writeText(friendMessage)
    setSent('copied')
  }
  const today = new Date().toLocaleDateString(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <main className="page" key="result">
      <header className="taskbar">
        <Mascot mood={VERDICT_MOOD[kind]} size={130} />
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
          {answer.noResult.some((n) => n.issue.kind !== 'joined') && <p className="why">{t.result.notAskedHard}</p>}
          <button className="primary" onClick={restart}>
            {t.result.restart}
          </button>
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
      {!invalid && (
        <>
          <div className="meter" role="img" aria-label={`${score}/100`}>
            <div className="meter-pin" key={score} style={{ left: `${score}%`, '--to': `${score}%` } as CSSProperties} />
          </div>
          <p className="fine">{t.result.score(score)}</p>
        </>
      )}
      <p className="fine caveat">{t.result.caveat}</p>
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
        </section>
      )}
      <section className="honest" hidden={invalid}>
        <h2>{ex ? t.crowd.caseTitle : t.crowd.title}</h2>
        <Crowd
          healthy={crowd.healthy}
          patients={crowd.patients}
          you={Math.round(first * 100)}
          label={ex ? '▼' : t.crowd.you}
          aria={t.crowd.aria(Math.round(first * 100))}
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
          <p>{invalid ? t.note.noResult(today, why) : t.note.line(today, v.title.toLowerCase(), score, Boolean(second))}</p>
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
          <button className="ghost" onClick={() => navigator.clipboard.writeText(studyLine).then(() => setCopied(true))}>
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
              <button className="ghost" onClick={() => navigator.clipboard.writeText(people.join('\n')).then(() => setCopied(true))}>
                {t.study.copyAll(people.length)}
              </button>
              <button
                className="link left"
                onClick={() => {
                  if (!window.confirm(t.study.clearConfirm)) return
                  savePeople([])
                  setPeople([])
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
