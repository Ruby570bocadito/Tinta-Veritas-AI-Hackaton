// Plays the whole check as a made-up person and writes down what Tinta says.
// It uses the app's own logic (check.ts, judge.ts, the model) and the app's own words (strings.ts). No browser.
// The order of the screens is repeated here from App.tsx; tools/screens.mjs walks the real screens.
import { check, laps, les, type Issue } from '../src/lib/check'
import { measure, seconds, type Stroke } from '../src/lib/ink'
import { judge, score, wantsCloser, type Answer } from '../src/lib/judge'
import { EXTRA_IDS, TASK_IDS, WARMUP_IDS, airShare, onScale } from '../src/lib/model'
import { STRINGS, type Lang } from '../src/lib/strings'
import { SHEET, perform, toStrokes } from './shapes.mjs'

/** How one task is done. See perform() in shapes.mjs. */
export type How = {
  do?: 'asked' | 'scribble' | 'taps' | 'dash'
  amount?: number
  lifts?: number
  pause?: number
  seconds?: number
  where?: 'guide' | 'corner' | 'tiny' | 'big'
  shaky?: boolean
  n?: number
}

export type Person = {
  name?: string
  all?: How // how every task is done, unless `tasks` says otherwise
  tasks?: Record<number, How> // by task number: 2 3 (practice) 5 9 16 (scored) 6 22 23 (closer look)
  onWarning?: 'retry' | 'keep' // when Tinta says a task cannot be compared: do it again properly, or keep it
  closer?: 'more' | 'stop' // when Tinta offers three more tasks
  lang?: Lang
}

export type Played = {
  answer: Answer
  lines: string[] // what was on each screen
  warned: number[] // tasks where Tinta said something
  retried: number[]
  closer: boolean
  said: string // the result in a few words, for tables
  modelAlone: string // what the models would have answered with no check of the tasks (the app before the checks existed)
}

const TASK_ORDER = [2, 3, 5, 9, 16] // the order of the screens, as in App.tsx: two practice tasks, then the three that count
const SHORT = { typical: 'usual pattern', unsure: "I can't tell", mention: 'worth mentioning' } as const

export function play(person: Person): Played {
  const t = STRINGS[person.lang ?? 'en']
  const ink: Record<number, Stroke[]> = {}
  const sheets: Record<number, typeof SHEET> = {}
  const lines: string[] = []
  const warned: number[] = []
  const retried: number[] = []
  let clock = 0

  const doTask = (id: number, index: number, of: number) => {
    const how = { ...person.all, ...person.tasks?.[id] }
    const text = t.tasks[id]
    const practice = WARMUP_IDS.includes(id)
    lines.push('', `== ${t.task.step(index + 1, of, text.title)}${practice ? '  (practice, not scored)' : ''}`)
    lines.push(`   Screen: "${text.instruction}"${text.prompt ? `  [${text.prompt}]` : ''}`)
    const attempt = (h: How): Issue | null => {
      ink[id] = toStrokes(perform(id, h), SHEET, clock)
      sheets[id] = SHEET
      clock += 60_000
      const m = measure(ink[id])
      const seen = id === 5 ? `, laps ${laps(ink[id]).toFixed(1)}` : id === 9 ? `, "le" ${les(ink[id], SHEET).toFixed(1)}` : ''
      lines.push(`   Person: ${describe(h)}`)
      lines.push(`   Measured: ${t.task.air} ${seconds(m.air_time)}, ${t.task.screen} ${seconds(m.paper_time)}, ${t.task.touches} ${m.num_of_pendown}${seen}`)
      return check(id, ink[id], SHEET)
    }
    // As in App.tsx: after a practice task, two buttons side by side; after a task that counts, doing it again is
    // the big button and leaving it is a smaller one that says there will be no result.
    const tinta = (issue: Issue) => `${t.check.text(issue)}${practice ? ' ' + t.check.practice : ''}`
    const keep = practice ? t.check.keep : t.check.leave
    const buttons = practice ? `[${t.check.keep}] [${t.check.again}]` : `[${t.check.again}]  (${t.check.leave})`
    let issue = attempt(how)
    if (!issue) return lines.push(`   Tinta: "${t.task.cheers[index]}"   [${index + 1 === of ? t.task.seeResult : t.task.next}]`)
    warned.push(id)
    lines.push(`   Tinta: "${tinta(issue)}"   ${buttons}`)
    if ((person.onWarning ?? 'keep') === 'keep') return lines.push(`   Person presses: ${keep}`)
    retried.push(id)
    lines.push(`   Person presses: ${t.check.again}`)
    // The second time the person does the whole task where it is asked, with the same hand. Told that there
    // was no pause to time, they write letter by letter; told that the practice is done in one go, they do not lift.
    const again: How = { ...how, do: 'asked', amount: 1, where: 'guide' }
    if (issue.kind === 'lifted') again.lifts = 0
    if (issue.kind === 'joined') delete again.lifts
    issue = attempt(again)
    lines.push(issue ? `   Tinta: "${tinta(issue)}"   Person presses: ${keep}` : `   Tinta: "${t.task.cheers[index]}"`)
  }

  TASK_ORDER.forEach((id, i) => doTask(id, i, TASK_ORDER.length))
  let closer = false
  if (wantsCloser(ink, sheets)) {
    lines.push('', `== ${t.closer.title}`, `   Screen: "${t.closer.body}"   [${t.closer.stop}] [${t.closer.more}]`)
    closer = (person.closer ?? 'more') === 'more'
    lines.push(`   Person presses: ${closer ? t.closer.more : t.closer.stop}`)
    if (closer) EXTRA_IDS.forEach((id, i) => doTask(id, TASK_ORDER.length + i, TASK_ORDER.length + EXTRA_IDS.length))
  }

  const answer = judge(ink, sheets, closer)
  const none = answer.noResult.length > 0
  const v = t.verdicts[answer.kind]
  const points = onScale(answer.p)
  const scored = TASK_IDS.map((id) => answer.byTask[id])
  const air = Math.round((100 * scored.reduce((sum, m) => sum + airShare(m), 0)) / scored.length)
  const touches = Math.round(scored.reduce((sum, m) => sum + m.num_of_pendown, 0) / scored.length)
  lines.push('', '== RESULT', `   Title: "${none ? t.result.noResultTitle : v.title}"`)
  if (none) {
    lines.push(`   Text: "${t.result.noResult(answer.noResult.length)}"`)
    for (const { id, issue } of answer.noResult) lines.push(`     - ${t.tasks[id].title}: "${t.check.text(issue)}"`)
    if (answer.noResult.some((n) => n.issue.kind === 'joined')) lines.push(`   Note: "${t.result.joinedWhy}"`)
    if (answer.noResult.some((n) => n.issue.kind !== 'joined')) lines.push(`   Note: "${t.result.notAskedHard}"`)
    lines.push('   (no number, no chart; the note for the doctor says there was no result and why)')
  } else {
    lines.push(`   Text: "${v.body}"`)
    lines.push(`   Then: "${t.note.detail(air, 22, touches, 2)}"   (the two "healthy people" numbers come from the study; shown here as examples)`)
    if (answer.second) {
      lines.push(`   Closer look: "${t.result.votesUnsure(onScale(answer.first))}" ${answer.second.votes.map((vote, i) => `${t.result.models[i]} ${Math.round(vote.p * 100)}`).join(', ')}`)
      if (answer.second.split) lines.push(`   Note: "${t.result.split}"`)
    }
    lines.push(`   Number: "${t.result.score(points)}"`)
    lines.push(`   ${t.result.whatNow} ${t.nextSteps[answer.kind].map((s) => `"${s}"`).join(' ')}`)
  }
  lines.push(`   Always shown: "${t.result.caveat}"`)

  const said = none
    ? `no result: ${answer.noResult.map((n) => `${t.tasks[n.id].title.toLowerCase()} ${WHY[n.issue.kind]}`).join(', ')}`
    : `${SHORT[answer.kind]} (${points}/100${answer.second ? ', after the closer look' : ''})`
  const alone = score(answer.byTask, closer && EXTRA_IDS.every((id) => (ink[id] ?? []).length > 0))
  return { answer, lines, warned, retried, closer, said, modelAlone: `${SHORT[alone.kind]} (${onScale(alone.p)}/100)` }
}

const WHY: Record<Issue['kind'], string> = { laps: 'not finished', loops: 'not finished', passes: 'not finished', lifted: 'lifted', part: 'not finished', little: 'hardly written', joined: 'written with no pause to time' }

function describe(h: How): string {
  const what = { asked: 'does the task', scribble: 'scribbles', taps: `taps ${h.n ?? 3} times`, dash: 'draws one short dash' }[h.do ?? 'asked']
  const bits = [
    (h.do ?? 'asked') === 'asked' && h.amount !== undefined && h.amount !== 1 ? `${Math.round(h.amount * 100)}% of it` : '',
    h.lifts !== undefined ? `lifting ${h.lifts} times` : '',
    h.pause !== undefined ? `${h.pause} s in the air each time` : '',
    h.seconds !== undefined ? `${h.seconds} s on the screen` : '',
    h.where && h.where !== 'guide' ? `(${h.where})` : '',
    h.shaky ? 'with a shaky hand' : '',
  ].filter(Boolean)
  return [what, ...bits].join(', ')
}
