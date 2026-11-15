// Try the check as a made-up person and read what Tinta says on every screen.
//
//   npx vite-node tools/try.ts '<json>'
//
// The JSON describes the person:
//   { "all":   { ...how every task is done... },
//     "tasks": { "5": { ...how task 5 is done... }, "9": { ... } },
//     "onWarning": "keep" | "retry",     when Tinta says a task was not done as asked (default "keep")
//     "closer":    "more" | "stop",      when Tinta offers three more tasks (default "more")
//     "lang":      "en" | "es" }
//
// Tasks: 2 and 3 are practice lines (not scored); 5 circle, 9 loops "le le le le", 16 word backwards (scored);
//        6 letters, 10 a word to copy, 18 the name of an object (only in the closer look).
//
// How a task is done (all optional):
//   "do":      "asked" (default) | "scribble" | "taps" | "dash"
//   "amount":  1 = the whole task, 0.25 = a quarter of it (one lap of four), 1.5 = half as much again
//   "lifts":   times the finger lifts during the task (default: none in lines, circle and loops; between letters in words)
//   "pause":   seconds in the air at each lift (default about 0.4)
//   "seconds": seconds with the finger on the screen
//   "where":   "guide" (default) | "corner" | "tiny" | "big"
//   "shaky":   true for a trembling hand
//   "n":       number of taps, with "do": "taps"
//
// Example: someone who does one lap of the circle, lifts a lot in the loops, and keeps it all:
//   npx vite-node tools/try.ts '{"tasks":{"5":{"amount":0.25},"9":{"lifts":6,"pause":1}},"onWarning":"keep"}'
import { readFileSync } from 'node:fs'
import { play, type Person } from './people'

const arg = process.argv[2]
if (!arg || arg === '--help') {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'))
  process.exit(arg ? 0 : 1)
}

let person: Person
try {
  person = JSON.parse(arg.trim().startsWith('{') ? arg : readFileSync(arg, 'utf8'))
} catch (e) {
  console.error('That is not valid JSON:', (e as Error).message, '\nRun with --help to see the format.')
  process.exit(1)
}

const KEYS = ['name', 'all', 'tasks', 'onWarning', 'closer', 'lang']
const HOW = ['do', 'amount', 'lifts', 'pause', 'seconds', 'where', 'shaky', 'n']
const TASKS = ['2', '3', '5', '9', '16', '6', '10', '18']
const complain = (what: string) => {
  console.error(what + '\nRun with --help to see the format.')
  process.exit(1)
}
for (const k of Object.keys(person)) if (!KEYS.includes(k)) complain(`Unknown key "${k}". Allowed: ${KEYS.join(', ')}.`)
for (const k of Object.keys(person.tasks ?? {})) if (!TASKS.includes(k)) complain(`There is no task ${k}. The tasks are ${TASKS.join(', ')}.`)
for (const how of [person.all ?? {}, ...Object.values(person.tasks ?? {})]) {
  for (const k of Object.keys(how)) if (!HOW.includes(k)) complain(`Unknown way of doing a task: "${k}". Allowed: ${HOW.join(', ')}.`)
  if (how.do && !['asked', 'scribble', 'taps', 'dash'].includes(how.do)) complain(`"do" must be asked, scribble, taps or dash; got "${how.do}".`)
  if (how.where && !['guide', 'corner', 'tiny', 'big'].includes(how.where)) complain(`"where" must be guide, corner, tiny or big; got "${how.where}".`)
}

const played = play(person)
console.log(played.lines.join('\n'))
console.log(`\nIn short: ${played.said}.`)
console.log(`Without the check of the tasks, the models alone would have said: ${played.modelAlone}.`)
