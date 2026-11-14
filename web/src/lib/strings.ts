// Every word Tinta says, in English and Spanish.
// English is for the judges; Spanish is for the families who actually try it.
import type { Issue } from './check'
import type { Verdict } from './model'

export type Lang = 'en' | 'es'

type TaskText = { title: string; instruction: string; prompt?: string; speak?: string }
type Qa = { q: string; a: string[] }

export type Strings = {
  voice: string // language tag for the spoken voice
  other: string // label of the button that switches to the other language
  prototype: string
  disclaimer: string
  private: string
  home: { bubble: string; title: string; lead: string; start: string; cases: string; ask: string; chips: string[]; how: string; steps: string[] }
  guide: { skip: string; back: string; next: string; gotIt: string; cards: { title: string; body: string }[] }
  ready: { title: string; tips: string[]; lead: string; begin: string }
  tasks: Record<number, TaskText>
  task: {
    step: (i: number, n: number, title: string) => string
    quit: string
    quitConfirm: string
    read: string
    listen: string
    noVoice: (n: string) => string
    writeHere: string
    startOver: string
    done: string
    next: string
    seeResult: string
    inkTitle: string
    legend: string
    again: string
    air: string
    screen: string
    touches: string
    cheers: string[]
  }
  closer: { title: string; body: string; stop: string; more: string }
  // What Tinta says when a task was clearly not done as asked.
  check: { text: (issue: Issue) => string; practice: string; scored: string; again: string; keep: string }
  verdicts: Record<Verdict, { title: string; body: string }>
  nextSteps: Record<Verdict, string[]>
  result: {
    yours: string
    realCase: (i: number, n: number, label: string) => string
    patient: string
    healthy: string
    right: string
    wrong: string
    noAnswer: string
    caveat: string
    noResultTitle: string
    noResult: (n: number) => string
    notAskedHard: string
    joinedWhy: string
    score: (s: number) => string
    whatNow: string
    measurements: string
    colTask: string
    colAir: string
    colTouches: string
    nextCase: string
    mistake: string
    votesUnsure: (s: number) => string
    votesDemo: (s: number) => string
    models: string[]
    split: string
    restart: string
    home: string
  }
  why: { missed: (air: number, usualAir: number, touches: number, usualTouches: number) => string; falseAlarm: (air: number, usualAir: number, touches: number, usualTouches: number) => string }
  note: {
    title: string
    line: (date: string, verdict: string, score: number, closer: boolean) => string
    detail: (air: number, usualAir: number, touches: number, usualTouches: number) => string
    noResult: (date: string, why: string) => string
    about: string
    print: string
  }
  history: {
    title: string
    first: string
    many: (n: number, last: number) => string
    explain: string
    clear: string
    clearConfirm: string
  }
  honest: {
    summary: string
    title: string
    short: (m: Record<string, number>, s: Record<string, number>, train: number, test: number) => string
    told: (p: Record<string, number>, h: Record<string, number>) => string
    closer: (a: Record<string, number>, test: number) => string
    device: (s: Record<string, number>, m: Record<string, number>) => string
    uneven: (pauses: Record<string, number>, screen: Record<string, number>) => string
    limits: string
  }
  study: { title: string; body: string; age: string; choose: string; bands: string[]; copy: string; copied: string; save: string; saved: (n: number) => string; copyAll: (n: number) => string; clear: string; clearConfirm: string }
  friends: { title: string; body: string; name: string; notes: string; notesHint: string; preview: string; send: string; sent: string; copied: string; header: string; result: string; nameLabel: string; notesLabel: string }
  crowd: { title: string; caseTitle: string; you: string; explain: (healthy: number, patients: number) => string; aria: (score: number) => string }
  ask: { title: string; lead: string; sources: string; back: string; items: Qa[] }
}

const en: Strings = {
  voice: 'en-US',
  other: 'Español',
  prototype: 'prototype',
  disclaimer: 'This project is a prototype and is not medical advice.',
  private: 'Nothing you write leaves this device.',
  home: {
    bubble: "Hi, I'm Tinta. Lend me your finger for two minutes?",
    title: 'How you write says more than what you write.',
    lead: "A two-minute writing check on the phone you already have. It looks for a pattern found in people with Alzheimer's, in a study of 174 people.",
    start: 'Start',
    cases: 'See real cases from the study',
    ask: 'Ask Tinta',
    chips: ['5 short tasks', 'About 2 minutes', 'Works offline'],
    how: 'How it goes',
    steps: ['Write with your finger', 'See your invisible ink', 'Get an honest answer'],
  },
  guide: {
    skip: 'Skip',
    back: 'Back',
    next: 'Next',
    gotIt: 'Got it',
    cards: [
      {
        title: "I time the pauses you can't see",
        body: 'Between one stroke and the next, your finger leaves the screen for a moment. Those tiny pauses grow when the mind has to work harder. Paper hides them. I can time them.',
      },
      {
        title: 'I look at where your time goes',
        body: 'Some people write fast, some slowly, and every phone is different. So I do not time how fast you are. I look at how much of each task your finger spends in the air, and how often you lift it.',
      },
      {
        title: 'What you write stays here',
        body: 'Everything is worked out on this phone. Nothing is sent anywhere. And I am a student prototype, not a doctor: my answer is a reason to talk to one, never a diagnosis.',
      },
    ],
  },
  ready: {
    title: 'Ready when you are',
    tips: [
      'Pick a calm moment, sitting down.',
      'Lay the phone flat on a table.',
      'Use the finger you would point with.',
      'Wear your glasses if you need them.',
    ],
    lead: 'There are no right or wrong drawings. Just write the way you always do.',
    begin: 'Begin',
  },
  tasks: {
    2: { title: 'Practice', instruction: 'Join the two dots with a line, back and forth four times, without lifting your finger.' },
    3: { title: 'Practice', instruction: 'Now up and down: join the two dots four times, without lifting your finger.' },
    16: { title: 'Backwards', instruction: 'Copy this word backwards, starting from its last letter.', prompt: 'house' },
    6: { title: 'Letters', instruction: 'Copy these three letters.', prompt: 'l  m  p' },
    5: { title: 'Circle', instruction: 'Trace over the circle four times in a row, without lifting your finger.' },
    9: { title: 'Loops', instruction: 'Write "le" four times in joined-up writing, in one smooth movement.', prompt: 'le le le le' },
    23: { title: 'Phone number', instruction: 'Tap "Listen", then write the phone number you hear.', speak: '3 4 7. 5 9 2. 0 1 6 8' },
    15: { title: 'Backwards', instruction: 'Copy this word backwards, starting from its last letter.', prompt: 'bottle' },
    18: { title: 'Name it', instruction: 'Write the name of the object in the picture.' },
    22: { title: 'Copy a number', instruction: 'Copy this phone number.', prompt: '091 748 2356' },
  },
  task: {
    step: (i, n, title) => `Step ${i} of ${n} · ${title}`,
    quit: 'Quit',
    quitConfirm: 'Stop the check and go back to the start?',
    read: 'Read it to me',
    listen: 'Listen',
    noVoice: (n) => `This device has no voice. Ask someone to read this number aloud to you: ${n}`,
    writeHere: 'Write here with your finger',
    startOver: 'Start over',
    done: "I'm done",
    next: 'Next',
    seeResult: 'See the result',
    inkTitle: 'Here is your invisible ink',
    legend: 'Orange is where your finger was off the screen. Bigger circles are longer pauses.',
    again: 'Play it again',
    air: 'In the air',
    screen: 'On the screen',
    touches: 'Touches',
    cheers: [
      'Lovely. That was just practice.',
      'Practice done. Now the real ones.',
      'Circle done. Two to go.',
      'Almost there. One more.',
      'That is all five tasks. Thank you!',
      'Thank you. Two more.',
      'One more and we are done.',
      'That is everything. Thank you!',
    ],
  },
  check: {
    text: (i) => {
      const four = 'The task asks for four.'
      switch (i.kind) {
        case 'laps':
          return i.seen < 1 ? `I could not see a full turn around the circle. ${four}` : `I counted ${i.seen === 1 ? 'one turn' : 'about two turns'} around the circle. ${four}`
        case 'loops':
          return i.seen < 1 ? 'I could not see any "le". The task asks for it four times.' : `I could see "le" ${i.seen === 1 ? 'once' : 'about twice'}. The task asks for it four times.`
        case 'passes':
          return `I counted ${i.seen === 0 ? 'no lines' : i.seen === 1 ? 'one line' : 'two lines'} between the dots. ${four}`
        case 'lifted':
          return `You lifted your finger ${i.seen} times. This one is meant to be done in one go, without lifting.`
        case 'part':
          return 'It looks like only part of it is there. Did you finish it?'
        case 'little':
          return 'I can hardly see any writing. Did you finish it?'
        case 'joined':
          return `You wrote it without lifting your finger, so there is no pause for me to time. Could you write it again, one ${i.digits ? 'number' : 'letter'} at a time, as you would with a pen?`
      }
    },
    practice: 'It is only practice, so nothing is scored yet.',
    scored: 'If you keep it, there will be no result at the end.',
    again: 'Try again',
    keep: 'Keep it',
  },
  closer: {
    title: 'Let me look a little closer',
    body: 'Your pattern sits between the two groups, so I would rather not guess. Three more short tasks, and then three models will look at all six.',
    stop: 'Stop here',
    more: 'Three more',
  },
  verdicts: {
    typical: {
      title: 'Within the usual pattern',
      body: 'On the two things I measure (how much of the time your finger was in the air, and how often it lifted), your writing looks like the healthy group in the study. I cannot see anything else.',
    },
    unsure: {
      title: "I can't tell from this",
      body: 'Your pattern sits between the two groups, so I would rather not guess. Try again another day, in a calm moment.',
    },
    mention: {
      title: 'Worth mentioning to a doctor',
      body: 'Your finger spent more time in the air, or lifted more often, than most healthy people in the study. This is not a diagnosis: some healthy people write like this too.',
    },
  },
  nextSteps: {
    typical: ["This check does not see everything: in the study, about one in five people with Alzheimer's got this same answer.", 'If you are worried about someone, see a doctor anyway.', 'You can come back another day and compare with today.'],
    unsure: ['One unclear result means nothing on its own.', 'Try again another day, rested and without hurry.'],
    mention: [
      'Do not worry about a single result. Tiredness, nerves or the phone itself can change it, and this check cannot tell which.',
      'Healthy people get this answer too: about one in seven in the study.',
      'Book a normal appointment with your family doctor and show the note below.',
      'Try again another day to see if the pattern repeats.',
    ],
  },
  result: {
    yours: 'Your result',
    realCase: (i, n, label) => `Real case ${i} of ${n} · this person is actually ${label}`,
    patient: 'a patient',
    healthy: 'healthy',
    right: 'Tinta gets this one right.',
    wrong: 'Tinta gets this one wrong.',
    noAnswer: 'Tinta gives no answer for this one.',
    noResultTitle: 'No result this time',
    noResult: (n) => `Thank you for trying. This time I cannot compare you with the people in the study, because of ${n === 1 ? 'this task' : 'these tasks'}:`,
    notAskedHard: 'If you were doing your best and a task was hard to finish, tell a doctor about that and show them this screen. It is useful for them to know.',
    joinedWhy: 'About writing without lifting: in the study people used a pen, and the tablet could also see the pen hovering over the paper, so nobody had zero time in the air. A phone cannot see a finger in the air. Three of my first eight phone volunteers wrote the word in a single drag, like you.',
    caveat: 'Tinta learned from pen-on-tablet data. On phones, only 8 healthy volunteers have tried her, and no patient has.',
    score: (s) => `${s} out of 100 on my scale. Under 35: usual pattern. Over 65: worth mentioning. In between: I don't know. A higher number is not better, and it is not a percentage of risk.`,
    whatNow: 'What now?',
    measurements: 'See the measurements',
    colTask: 'Task',
    colAir: 'In the air',
    colTouches: 'Touches',
    nextCase: 'Next case',
    mistake: 'Show a mistake',
    votesUnsure: (s) => `The short check was unsure (${s}/100), so three models looked at all six tasks:`,
    votesDemo: (s) => `Demo mode: the short check was clear (${s}/100), but here is the closer look anyway:`,
    models: ['Straight-line model', 'Nearest-pattern model', 'Forest of small trees'],
    split: 'My three models disagree a lot about this one. When that happens I say "I can\'t tell" instead of picking a side.',
    restart: 'Start again',
    home: 'Back to the start',
  },
  why: {
    missed: (air, usualAir, touches, usualTouches) =>
      `This patient's pen was in the air ${air}% of the time and touched down ${touches} times per task. Typical for healthy people in the study: ${usualAir}% and ${usualTouches}. Tinta still answered "usual pattern". Some patients are simply not set apart by these two measures, and Tinta cannot see anything else.`,
    falseAlarm: (air, usualAir, touches, usualTouches) =>
      `This healthy person's pen was in the air ${air}% of the time and touched down ${touches} times per task. Typical for healthy people in the study: ${usualAir}% and ${usualTouches}. Tinta still answered "worth mentioning". Some healthy people pause or lift as much as patients do: a careful or hesitant way of writing looks the same to Tinta.`,
  },
  note: {
    title: 'Note for the doctor',
    line: (date, verdict, score, closer) =>
      `${date}. A short writing check done at home on a phone, with a finger. Result: ${verdict} (${score} out of 100 on the app's scale${closer ? ', after a closer look with three extra tasks' : ''}).`,
    detail: (air, usualAir, touches, usualTouches) =>
      `In the scored tasks the finger was off the screen ${air}% of the time (healthy people in the study: about ${usualAir}%) and touched down ${touches} times per task (about ${usualTouches}).`,
    noResult: (date, why) => `${date}. A short writing check done at home on a phone, with a finger. It gave no result. ${why}`,
    about: 'Tinta is a student prototype trained on the public DARWIN dataset (174 people). It is not a medical device and has not been validated with patients on phones. It is meant to start a conversation.',
    print: 'Print or save as PDF',
  },
  history: {
    title: 'You against you',
    first: 'This is your first check on this phone. Come back another day and you will see your checks side by side here.',
    many: (n, last) => `Check number ${n} on this phone. Last time: ${last} out of 100.`,
    explain: 'One check says little. In our simulations a second attempt moved the score by about 5 points, so ignore changes smaller than 10. We have not measured this with real people.',
    clear: 'Forget my history',
    clearConfirm: 'Delete all your past results from this phone?',
  },
  honest: {
    summary: 'How sure can you be? The honest numbers',
    title: 'How well does it work?',
    short: (m, s, train, test) =>
      `Trained on ${train} people and checked on ${test} others (${m.patients} patients, ${m.healthy} healthy) that were held out of training, though I did look at them while designing the app. Cutting the score at 50, the short check missed ${m.missed} patients and raised ${m.false_alarms} false alarms. A plain stopwatch rule missed ${s.missed} and raised ${s.false_alarms}: on the study's own tablet, a stopwatch is about as good.`,
    told: (p, h) =>
      `What those people would actually be told by the app: of the ${p.usual + p.unsure + p.mention} patients, ${p.mention} "worth mentioning", ${p.unsure} "I can't tell" and ${p.usual} "usual pattern" (those ${p.usual} are the dangerous misses). Of the ${h.usual + h.unsure + h.mention} healthy people, ${h.usual} "usual pattern", ${h.unsure} "I can't tell" and ${h.mention} "worth mentioning" (false alarms).`,
    closer: (a, test) =>
      `When the short check is unsure, Tinta asks for three more tasks and averages three models. With that closer look (${a.closer_look} of the ${test} needed it), she missed ${a.missed} patients and raised ${a.false_alarms} false alarm${a.false_alarms === 1 ? '' : 's'}, and still said "I can't tell" for ${a.still_unsure}.`,
    device: (s, m) =>
      `But a phone is not that tablet. If a device makes everyone 1.5 times slower, the stopwatch raises ${s.false_alarms} false alarms out of ${s.healthy} healthy people. Tinta still raises ${m.false_alarms}: her two measures are a share and a count, so overall speed cancels out. That is arithmetic, not a discovery.`,
    uneven: (pauses, screen) =>
      `The real risk is a device that changes pauses and strokes by different amounts. If only the pauses doubled, Tinta would wrongly flag ${pauses.false_alarms} of ${pauses.healthy} healthy people. If only the strokes took twice as long, she would miss ${screen.missed} of ${screen.patients} patients. This simulation also keeps the number of touches fixed, and a finger may lift more or less than a pen. Only data from real phones can tell.`,
    limits: 'Limits: the study compared people already diagnosed with healthy people, half and half, using a pen on a tablet, in Italian. In real life far fewer people have the disease, so most "worth mentioning" results would be false alarms. Tinta raises more false alarms for slow writers and misses more patients among fast ones. The study does not publish age or sex, so we cannot check those groups. It has not been tested with patients on a phone. Treat a result as a reason to talk to a doctor, never as an answer.',
  },
  study: {
    title: 'Study mode',
    body: 'Only timings are saved: no name, no drawing. Ask the person first.',
    age: 'Age band',
    choose: 'Choose…',
    bands: ['under 30', '30 to 59', '60 or over'],
    copy: 'Copy timings',
    copied: 'Copied',
    save: 'Save this person on this phone',
    saved: (n) => `Saved. ${n} on this phone.`,
    copyAll: (n) => `Copy all ${n} people`,
    clear: 'Delete the saved people',
    clearConfirm: 'Delete every saved person from this phone?',
  },
  friends: {
    title: 'Tell us how it went',
    body: 'You were invited to try Tinta. If you want, send your result and your opinion to the person who invited you. Nothing is sent unless you press the button and choose who gets it. Your drawings are never included, only timings.',
    name: 'Your name (optional)',
    notes: 'What did you think?',
    notesHint: 'Was anything confusing? Did anything look wrong on your phone?',
    preview: 'See exactly what will be sent',
    send: 'Send it',
    sent: 'Thank you!',
    copied: 'Copied. Paste it in a message to the person who invited you.',
    header: 'Tinta test',
    result: 'Result',
    nameLabel: 'Name',
    notesLabel: 'Notes',
  },
  crowd: {
    title: 'You among the 174 people in the study',
    caseTitle: 'This person among the 174 in the study',
    you: 'you',
    explain: (healthy, patients) =>
      `Each dot is one person from the study, placed by the short-check score from a model that had not seen them. Green, above: the ${healthy} healthy people. Orange, below: the ${patients} people with Alzheimer's. The dark line is the short-check score of this result. Look at the middle: the two groups mix. That is why I am sometimes wrong, and why I sometimes say I can't tell.`,
    aria: (score) => `Dot chart of the 174 people in the study by score. The short-check score of this result is ${score} out of 100.`,
  },
  ask: {
    title: 'Ask Tinta',
    lead: 'Tap a question. These answers were written and checked by hand, so they are the same for everyone and work without internet.',
    sources: 'Where this comes from',
    back: 'Back',
    items: [
      {
        q: 'What exactly do you measure?',
        a: [
          'Two things in each task: what share of the time your finger is off the screen, and how many times you touch down.',
          'I do not time how fast you are, and I never look at what you wrote or how pretty it is.',
        ],
      },
      {
        q: "Why would handwriting change with Alzheimer's?",
        a: [
          'Writing looks easy but uses a lot of the brain at once: memory, planning, attention and fine movement.',
          'When that gets harder, people hesitate more between strokes. In the study I learned from, people with Alzheimer\'s spent a larger share of each task with the pen in the air, and lifted it more often.',
        ],
      },
      {
        q: "What is Alzheimer's disease?",
        a: [
          'It is the most common cause of dementia: about 6 or 7 of every 10 cases. It slowly damages memory, thinking and the ability to manage everyday life.',
          'It is more common with age, but it is not a normal part of getting older.',
        ],
      },
      {
        q: 'Why does it happen?',
        a: [
          'Two proteins, called amyloid and tau, build up in the brain in an abnormal way and damage the nerve cells and the connections between them.',
          'Scientists still do not fully know why this starts. Age is the biggest risk factor. In most people it is not directly inherited.',
        ],
      },
      {
        q: 'What are the early signs?',
        a: [
          'Forgetting recent things or events, losing or misplacing things, getting lost in familiar places, losing track of time, trouble following a conversation or finding words, and trouble with familiar tasks.',
          'Everybody forgets things sometimes. What matters is a change that keeps going and gets in the way of daily life.',
        ],
      },
      {
        q: 'Can it be prevented or cured?',
        a: [
          'There is no cure today. There are treatments and support that can help with symptoms, and they help more when the disease is found early.',
          'You can lower your risk: keep moving, do not smoke, go easy on alcohol, eat well, and keep blood pressure, sugar and cholesterol under control. Staying social and mentally active helps too.',
        ],
      },
      {
        q: 'You said "worth mentioning to a doctor". Do I have Alzheimer\'s?',
        a: [
          'No, I cannot know that. I only saw that your finger paused or lifted more than usual. Tiredness, nerves, a small screen, poor eyesight or sore hands can do the same.',
          'About one healthy person in five gets a false alarm from me. So take it as a nudge to mention it at your next appointment, and try again another day.',
        ],
      },
      {
        q: 'How often are you right?',
        a: [
          'About 3 times out of 4, tested on people in the study that the model had not been trained on. So I am wrong about 1 time in 4, in both directions. A simple stopwatch does a little better on the study\'s own tablet.',
          'And that study used a pen on a tablet, which can also see the pen hovering over the paper. A phone cannot see your finger in the air, so on a phone my numbers run low. Only eight healthy volunteers have tried me on phones, and no patient has. I say so on every result.',
        ],
      },
      {
        q: 'Does anything I write leave my phone?',
        a: ['No. All the maths runs here, on this phone. There is no account and no server. Your past results are kept only on this phone, and you can delete them whenever you want.'],
      },
      {
        q: 'Who made you?',
        a: ['A high-school student, in one weekend, for a hackathon. I am a prototype to show an idea, not a medical device.'],
      },
    ],
  },
}

const es: Strings = {
  voice: 'es-ES',
  other: 'English',
  prototype: 'prototipo',
  disclaimer: 'Este proyecto es un prototipo y no es consejo médico.',
  private: 'Nada de lo que escribes sale de este móvil.',
  home: {
    bubble: 'Hola, soy Tinta. ¿Me prestas un dedo dos minutos?',
    title: 'Cómo escribes dice más que lo que escribes.',
    lead: 'Una prueba de escritura de dos minutos en el móvil que ya tienes. Busca un patrón que se vio en personas con alzhéimer, en un estudio con 174 personas.',
    start: 'Empezar',
    cases: 'Ver casos reales del estudio',
    ask: 'Pregunta a Tinta',
    chips: ['5 tareas cortas', 'Unos 2 minutos', 'Funciona sin internet'],
    how: 'Cómo va',
    steps: ['Escribe con el dedo', 'Mira tu tinta invisible', 'Recibe una respuesta honesta'],
  },
  guide: {
    skip: 'Saltar',
    back: 'Atrás',
    next: 'Siguiente',
    gotIt: 'Entendido',
    cards: [
      {
        title: 'Mido las pausas que no ves',
        body: 'Entre un trazo y el siguiente, tu dedo se levanta un momento. Esas pausas pequeñas crecen cuando la mente tiene que esforzarse más. El papel las esconde. Yo puedo medirlas.',
      },
      {
        title: 'Miro en qué se te va el tiempo',
        body: 'Hay quien escribe rápido y quien escribe despacio, y cada móvil es distinto. Por eso no mido lo rápido que eres. Miro qué parte de cada tarea pasa tu dedo en el aire y cuántas veces lo levantas.',
      },
      {
        title: 'Lo que escribes se queda aquí',
        body: 'Todo se calcula en este móvil. No se envía nada a ningún sitio. Y soy un prototipo hecho por un estudiante, no un médico: mi respuesta es un motivo para hablar con uno, nunca un diagnóstico.',
      },
    ],
  },
  ready: {
    title: 'Cuando quieras',
    tips: [
      'Elige un momento tranquilo, con calma y sentado.',
      'Deja el móvil apoyado en una mesa.',
      'Usa el dedo con el que señalas.',
      'Ponte las gafas si las necesitas.',
    ],
    lead: 'No hay dibujos buenos ni malos. Escribe como escribes siempre.',
    begin: 'Vamos',
  },
  tasks: {
    2: { title: 'Práctica', instruction: 'Une los dos puntos con una línea, ida y vuelta cuatro veces, sin levantar el dedo.' },
    3: { title: 'Práctica', instruction: 'Ahora de arriba abajo: une los dos puntos cuatro veces, sin levantar el dedo.' },
    16: { title: 'Al revés', instruction: 'Copia esta palabra al revés, empezando por la última letra.', prompt: 'casa' },
    6: { title: 'Letras', instruction: 'Copia estas tres letras.', prompt: 'l  m  p' },
    5: { title: 'Círculo', instruction: 'Repasa el círculo cuatro veces seguidas, sin levantar el dedo.' },
    9: { title: 'Bucles', instruction: 'Escribe «le» cuatro veces con letra ligada, de un tirón.', prompt: 'le le le le' },
    23: { title: 'Teléfono', instruction: 'Pulsa «Escuchar» y escribe el número de teléfono que oigas.', speak: '3, 4, 7. 5, 9, 2. 0, 1, 6, 8' },
    15: { title: 'Al revés', instruction: 'Copia esta palabra al revés, empezando por la última letra.', prompt: 'botella' },
    18: { title: '¿Qué es?', instruction: 'Escribe el nombre del objeto del dibujo.' },
    22: { title: 'Copia un número', instruction: 'Copia este número de teléfono.', prompt: '091 748 2356' },
  },
  task: {
    step: (i, n, title) => `Paso ${i} de ${n} · ${title}`,
    quit: 'Salir',
    quitConfirm: '¿Dejar la prueba y volver al principio?',
    read: 'Léemelo',
    listen: 'Escuchar',
    noVoice: (n) => `Este móvil no tiene voz. Pide a alguien que te lea este número en voz alta: ${n}`,
    writeHere: 'Escribe aquí con el dedo',
    startOver: 'Borrar',
    done: 'Ya está',
    next: 'Siguiente',
    seeResult: 'Ver el resultado',
    inkTitle: 'Esta es tu tinta invisible',
    legend: 'En naranja, por dónde fue tu dedo sin tocar la pantalla. Cuanto más grande el círculo, más larga la pausa.',
    again: 'Verlo otra vez',
    air: 'En el aire',
    screen: 'En la pantalla',
    touches: 'Toques',
    cheers: [
      'Muy bien. Eso era solo para practicar.',
      'Práctica hecha. Ahora las de verdad.',
      'Círculo hecho. Quedan dos.',
      'Ya casi. Una más.',
      'Ya están las cinco tareas. ¡Gracias!',
      'Gracias. Dos más.',
      'Una más y terminamos.',
      'Eso es todo. ¡Gracias!',
    ],
  },
  check: {
    text: (i) => {
      const four = 'La tarea pide cuatro.'
      switch (i.kind) {
        case 'laps':
          return i.seen < 1 ? 'No he visto ninguna vuelta completa al círculo. La tarea pide cuatro vueltas.' : `He contado ${i.seen === 1 ? 'una vuelta' : 'unas dos vueltas'} al círculo. ${four}`
        case 'loops':
          return i.seen < 1 ? 'No he visto ningún «le». La tarea pide escribirlo cuatro veces.' : `He visto «le» ${i.seen === 1 ? 'una vez' : 'unas dos veces'}. La tarea pide escribirlo cuatro veces.`
        case 'passes':
          return `${i.seen === 0 ? 'No he visto ninguna línea' : i.seen === 1 ? 'He contado una línea' : 'He contado dos líneas'} entre los puntos. ${four}`
        case 'lifted':
          return `Has levantado el dedo ${i.seen} veces. Esta tarea es para hacerla de un tirón, sin levantarlo.`
        case 'part':
          return 'Parece que falta una parte. ¿La has terminado?'
        case 'little':
          return 'Casi no veo nada escrito. ¿La has terminado?'
        case 'joined':
          return `Lo has escrito sin levantar el dedo, así que no tengo ninguna pausa que cronometrar. ¿Lo escribes otra vez, ${i.digits ? 'número a número' : 'letra a letra'}, como con un boli?`
      }
    },
    practice: 'Es solo práctica: todavía no puntúa nada.',
    scored: 'Si la dejas así, al final no habrá resultado.',
    again: 'Repetirla',
    keep: 'Dejarla así',
  },
  closer: {
    title: 'Déjame mirar un poco mejor',
    body: 'Tu patrón queda entre los dos grupos, y prefiero no adivinar. Tres tareas cortas más, y después tres modelos mirarán las seis.',
    stop: 'Lo dejo aquí',
    more: 'Tres más',
  },
  verdicts: {
    typical: {
      title: 'Dentro de lo habitual',
      body: 'En las dos cosas que mido (cuánto tiempo pasó tu dedo en el aire y cuántas veces se levantó), tu escritura se parece a la del grupo sano del estudio. No puedo ver nada más.',
    },
    unsure: {
      title: 'Con esto no lo sé',
      body: 'Tu patrón queda entre los dos grupos, y prefiero no adivinar. Prueba otro día, en un momento tranquilo.',
    },
    mention: {
      title: 'Coméntalo con tu médico',
      body: 'Tu dedo pasó más tiempo en el aire, o se levantó más veces, que la mayoría de las personas sanas del estudio. Esto no es un diagnóstico: algunas personas sanas también escriben así.',
    },
  },
  nextSteps: {
    typical: ['Esta prueba no lo ve todo: en el estudio, a una de cada cinco personas con alzhéimer le salió esta misma respuesta.', 'Si alguien te preocupa, ve al médico igualmente.', 'Puedes volver otro día y comparar con hoy.'],
    unsure: ['Un resultado dudoso no significa nada por sí solo.', 'Prueba otro día, con calma y sin prisa.'],
    mention: [
      'No te preocupes por un solo resultado. El cansancio, los nervios o el propio móvil pueden cambiarlo, y esta prueba no sabe distinguirlo.',
      'A las personas sanas también les sale: a una de cada siete en el estudio.',
      'Pide una cita normal con tu médico de cabecera y enséñale la nota de abajo.',
      'Repítelo otro día para ver si el patrón se mantiene.',
    ],
  },
  result: {
    yours: 'Tu resultado',
    realCase: (i, n, label) => `Caso real ${i} de ${n} · esta persona en realidad es ${label}`,
    patient: 'paciente',
    healthy: 'sana',
    right: 'Tinta acierta en este.',
    wrong: 'Tinta se equivoca en este.',
    noAnswer: 'En este, Tinta no da respuesta.',
    noResultTitle: 'Esta vez no hay resultado',
    noResult: (n) => `Gracias por intentarlo. Esta vez no puedo compararte con las personas del estudio, por ${n === 1 ? 'esta tarea' : 'estas tareas'}:`,
    notAskedHard: 'Si lo estabas haciendo lo mejor que podías y alguna tarea te costó terminarla, cuéntaselo a un médico y enséñale esta pantalla. Le sirve saberlo.',
    joinedWhy: 'Sobre escribir sin levantar el dedo: en el estudio se escribía con lápiz, y la tableta veía también el lápiz flotando sobre el papel, así que nadie tuvo cero tiempo en el aire. Un móvil no ve el dedo en el aire. Tres de mis ocho primeros voluntarios con móvil escribieron la palabra de un solo trazo, como tú.',
    caveat: 'Tinta aprendió con datos de lápiz sobre tableta. En móviles solo la han probado 8 voluntarios sanos, y ningún paciente.',
    score: (s) => `${s} sobre 100 en mi escala. Menos de 35: dentro de lo habitual. Más de 65: coméntalo. En medio: no lo sé. Un número más alto no es mejor, y tampoco es un porcentaje de riesgo.`,
    whatNow: '¿Y ahora qué?',
    measurements: 'Ver las medidas',
    colTask: 'Tarea',
    colAir: 'En el aire',
    colTouches: 'Toques',
    nextCase: 'Otro caso',
    mistake: 'Ver un fallo',
    votesUnsure: (s) => `La prueba corta no lo tenía claro (${s}/100), así que tres modelos miraron las seis tareas:`,
    votesDemo: (s) => `Modo demostración: la prueba corta era clara (${s}/100), pero aquí va la segunda mirada:`,
    models: ['Modelo de línea recta', 'Modelo de parecidos', 'Bosque de arbolitos'],
    split: 'Mis tres modelos no se ponen de acuerdo con este caso. Cuando pasa eso, digo «no lo sé» en vez de elegir un bando.',
    restart: 'Empezar otra vez',
    home: 'Volver al principio',
  },
  why: {
    missed: (air, usualAir, touches, usualTouches) =>
      `El lápiz de este paciente estuvo en el aire el ${air} % del tiempo y se apoyó ${touches} veces por tarea. Lo típico en las personas sanas del estudio: ${usualAir} % y ${usualTouches}. Aun así, Tinta contestó «dentro de lo habitual». A algunos pacientes estas dos medidas no los distinguen, y Tinta no puede ver nada más.`,
    falseAlarm: (air, usualAir, touches, usualTouches) =>
      `El lápiz de esta persona sana estuvo en el aire el ${air} % del tiempo y se apoyó ${touches} veces por tarea. Lo típico en las personas sanas del estudio: ${usualAir} % y ${usualTouches}. Aun así, Tinta contestó «coméntalo». Algunas personas sanas hacen tantas pausas o levantan tanto el lápiz como los pacientes: una forma de escribir cuidadosa o con dudas le parece lo mismo.`,
  },
  note: {
    title: 'Nota para el médico',
    line: (date, verdict, score, closer) =>
      `${date}. Prueba corta de escritura hecha en casa con el dedo, en un móvil. Resultado: ${verdict} (${score} sobre 100 en la escala de la app${closer ? ', tras una segunda mirada con tres tareas más' : ''}).`,
    detail: (air, usualAir, touches, usualTouches) =>
      `En las tareas puntuadas, el dedo estuvo sin tocar la pantalla el ${air} % del tiempo (personas sanas del estudio: alrededor del ${usualAir} %) y se apoyó ${touches} veces por tarea (alrededor de ${usualTouches}).`,
    noResult: (date, why) => `${date}. Prueba corta de escritura hecha en casa con el dedo, en un móvil. No dio resultado. ${why}`,
    about: 'Tinta es un prototipo de estudiante entrenado con el conjunto público DARWIN (174 personas). No es un producto sanitario y no se ha validado con pacientes en móviles. Sirve para empezar una conversación.',
    print: 'Imprimir o guardar en PDF',
  },
  history: {
    title: 'Tú contra ti',
    first: 'Es tu primera prueba en este móvil. Vuelve otro día y aquí verás tus pruebas una junto a otra.',
    many: (n, last) => `Prueba número ${n} en este móvil. La última vez: ${last} sobre 100.`,
    explain: 'Una sola prueba dice poco. En nuestras simulaciones, un segundo intento movía el número unos 5 puntos, así que no hagas caso a cambios de menos de 10. No lo hemos medido con personas reales.',
    clear: 'Olvidar mi historial',
    clearConfirm: '¿Borrar todos tus resultados anteriores de este móvil?',
  },
  honest: {
    summary: '¿Cuánto te puedes fiar? Los números, sin adornos',
    title: '¿Cómo de bien funciona?',
    short: (m, s, train, test) =>
      `Entrenada con ${train} personas y comprobada con otras ${test} (${m.patients} pacientes, ${m.healthy} sanas) que no entraron en el entrenamiento, aunque sí las miré mientras diseñaba la app. Cortando la escala en 50, a la prueba corta se le escaparon ${m.missed} pacientes y dio ${m.false_alarms} falsas alarmas. Una regla de cronómetro falló con ${s.missed} y dio ${s.false_alarms}: en la tableta del estudio, un cronómetro acierta más o menos lo mismo.`,
    told: (p, h) =>
      `Lo que la app les diría de verdad a esas personas: de los ${p.usual + p.unsure + p.mention} pacientes, a ${p.mention} «coméntalo», a ${p.unsure} «no lo sé» y a ${p.usual} «dentro de lo habitual» (esos ${p.usual} son los fallos peligrosos). De las ${h.usual + h.unsure + h.mention} personas sanas, a ${h.usual} «dentro de lo habitual», a ${h.unsure} «no lo sé» y a ${h.mention} «coméntalo» (falsas alarmas).`,
    closer: (a, test) =>
      `Cuando la prueba corta duda, Tinta pide tres tareas más y hace la media de tres modelos. Con esa segunda mirada (la necesitaron ${a.closer_look} de las ${test}), se le escaparon ${a.missed} pacientes, dio ${a.false_alarms} falsa${a.false_alarms === 1 ? '' : 's'} alarma${a.false_alarms === 1 ? '' : 's'} y siguió diciendo «no lo sé» en ${a.still_unsure}.`,
    device: (s, m) =>
      `Pero un móvil no es esa tableta. Si un aparato hace a todo el mundo 1,5 veces más lento, el cronómetro da ${s.false_alarms} falsas alarmas entre ${s.healthy} personas sanas. Tinta sigue dando ${m.false_alarms}: sus dos medidas son una proporción y un recuento, así que la velocidad general no cuenta. Eso es aritmética, no un descubrimiento.`,
    uneven: (pauses, screen) =>
      `El riesgo de verdad es un aparato que cambie las pausas y los trazos en distinta medida. Si solo se duplicaran las pausas, Tinta marcaría por error a ${pauses.false_alarms} de ${pauses.healthy} personas sanas. Si solo los trazos tardaran el doble, se le escaparían ${screen.missed} de ${screen.patients} pacientes. Esta simulación, además, deja fijo el número de toques, y un dedo puede levantarse más o menos que un lápiz. Solo los datos de móviles de verdad pueden decirlo.`,
    limits: 'Límites: el estudio comparó a personas ya diagnosticadas con personas sanas, mitad y mitad, con lápiz sobre una tableta y en italiano. En la vida real hay muchas menos personas con la enfermedad, así que la mayoría de los «coméntalo» serían falsas alarmas. Tinta da más falsas alarmas a quien escribe despacio y se le escapan más pacientes entre quienes escriben rápido. El estudio no publica edad ni sexo, así que no podemos comprobar esos grupos. No se ha probado con pacientes en un móvil. Toma el resultado como un motivo para hablar con un médico, nunca como una respuesta.',
  },
  study: {
    title: 'Modo estudio',
    body: 'Solo se guardan tiempos: ni nombre ni dibujo. Pregunta antes a la persona.',
    age: 'Franja de edad',
    choose: 'Elige…',
    bands: ['menos de 30', 'de 30 a 59', '60 o más'],
    copy: 'Copiar tiempos',
    copied: 'Copiado',
    save: 'Guardar a esta persona en este móvil',
    saved: (n) => `Guardado. ${n} en este móvil.`,
    copyAll: (n) => `Copiar las ${n} personas`,
    clear: 'Borrar las personas guardadas',
    clearConfirm: '¿Borrar de este móvil a todas las personas guardadas?',
  },
  friends: {
    title: 'Cuéntanos qué tal',
    body: 'Te han invitado a probar Tinta. Si quieres, envía tu resultado y tu opinión a quien te invitó. No se envía nada si no pulsas el botón y eliges a quién. Tus dibujos nunca se incluyen, solo los tiempos.',
    name: 'Tu nombre (opcional)',
    notes: '¿Qué te ha parecido?',
    notesHint: '¿Algo te ha confundido? ¿Algo se veía mal en tu móvil?',
    preview: 'Ver exactamente lo que se enviará',
    send: 'Enviar',
    sent: '¡Gracias!',
    copied: 'Copiado. Pégalo en un mensaje a quien te invitó.',
    header: 'Prueba de Tinta',
    result: 'Resultado',
    nameLabel: 'Nombre',
    notesLabel: 'Notas',
  },
  crowd: {
    title: 'Tú entre las 174 personas del estudio',
    caseTitle: 'Esta persona entre las 174 del estudio',
    you: 'tú',
    explain: (healthy, patients) =>
      `Cada punto es una persona del estudio, colocada según el número de la prueba corta que le dio un modelo que no la había visto. En verde, arriba: las ${healthy} personas sanas. En naranja, abajo: las ${patients} personas con alzhéimer. La línea oscura es el número de la prueba corta de este resultado. Mira el centro: los dos grupos se mezclan. Por eso a veces me equivoco, y por eso a veces digo que no lo sé.`,
    aria: (score) => `Gráfica de puntos de las 174 personas del estudio según su número. El número de la prueba corta de este resultado es ${score} sobre 100.`,
  },
  ask: {
    title: 'Pregunta a Tinta',
    lead: 'Toca una pregunta. Estas respuestas están escritas y revisadas a mano: son las mismas para todos y funcionan sin internet.',
    sources: 'De dónde sale esto',
    back: 'Atrás',
    items: [
      {
        q: '¿Qué mides exactamente?',
        a: [
          'Dos cosas en cada tarea: qué parte del tiempo está tu dedo sin tocar la pantalla y cuántas veces lo apoyas.',
          'No mido lo rápido que eres, y nunca miro qué has escrito ni si queda bonito.',
        ],
      },
      {
        q: '¿Por qué cambia la escritura con el alzhéimer?',
        a: [
          'Escribir parece fácil, pero usa mucho cerebro a la vez: memoria, planificación, atención y movimiento fino.',
          'Cuando eso cuesta más, la persona duda más entre trazo y trazo. En el estudio del que aprendí, las personas con alzhéimer pasaban una parte mayor de cada tarea con el lápiz en el aire y lo levantaban más veces.',
        ],
      },
      {
        q: '¿Qué es el alzhéimer?',
        a: [
          'Es la causa más común de demencia: unos 6 o 7 de cada 10 casos. Daña poco a poco la memoria, el pensamiento y la capacidad de manejarse en el día a día.',
          'Es más frecuente con la edad, pero no es una parte normal de envejecer.',
        ],
      },
      {
        q: '¿Por qué ocurre?',
        a: [
          'Dos proteínas, llamadas amiloide y tau, se acumulan en el cerebro de forma anormal y dañan las neuronas y las conexiones entre ellas.',
          'La ciencia todavía no sabe del todo por qué empieza. La edad es el mayor factor de riesgo. En la mayoría de las personas no se hereda directamente.',
        ],
      },
      {
        q: '¿Cuáles son las primeras señales?',
        a: [
          'Olvidar cosas o hechos recientes, perder objetos o dejarlos donde no tocan, desorientarse en sitios conocidos, perder la noción del tiempo, costarle seguir una conversación o encontrar las palabras, y tener dificultades con tareas de siempre.',
          'Todo el mundo olvida cosas a veces. Lo que importa es un cambio que continúa y que estorba en la vida diaria.',
        ],
      },
      {
        q: '¿Se puede prevenir o curar?',
        a: [
          'Hoy no tiene cura. Hay tratamientos y apoyos que ayudan con los síntomas, y ayudan más cuando la enfermedad se detecta pronto.',
          'Sí puedes bajar el riesgo: moverte, no fumar, poco alcohol, comer bien y tener controlados la tensión, el azúcar y el colesterol. Mantener la vida social y la mente activa también ayuda.',
        ],
      },
      {
        q: 'Me has dicho «coméntalo con tu médico». ¿Tengo alzhéimer?',
        a: [
          'No, eso no puedo saberlo. Solo he visto que tu dedo se paró o se levantó más de lo habitual. El cansancio, los nervios, una pantalla pequeña, ver mal o tener las manos doloridas pueden hacer lo mismo.',
          'A una de cada cinco personas sanas le doy una falsa alarma. Tómalo como un empujón para comentarlo en tu próxima cita, y repítelo otro día.',
        ],
      },
      {
        q: '¿Cuántas veces aciertas?',
        a: [
          'Unas 3 de cada 4, probando con personas del estudio con las que el modelo no se había entrenado. O sea, me equivoco 1 de cada 4, en los dos sentidos. Un simple cronómetro acierta un poco más en la tableta del estudio.',
          'Y ese estudio se hizo con lápiz y una tableta que ve también el lápiz flotando sobre el papel. Un móvil no ve tu dedo en el aire, así que en un móvil mis números salen bajos. En móviles solo me han probado ocho voluntarios sanos, y ningún paciente. Lo digo en cada resultado.',
        ],
      },
      {
        q: '¿Sale de mi móvil algo de lo que escribo?',
        a: ['No. Todas las cuentas se hacen aquí, en este móvil. No hay cuenta ni servidor. Tus resultados anteriores se guardan solo en este móvil y puedes borrarlos cuando quieras.'],
      },
      {
        q: '¿Quién te ha hecho?',
        a: ['Un estudiante de instituto, en un fin de semana, para un hackatón. Soy un prototipo para enseñar una idea, no un producto sanitario.'],
      },
    ],
  },
}

export const STRINGS: Record<Lang, Strings> = { en, es }

// Where the answers in "Ask Tinta" come from.
export const SOURCES = [
  { name: 'World Health Organization: Dementia fact sheet', url: 'https://www.who.int/news-room/fact-sheets/detail/dementia' },
  { name: "US National Institute on Aging: Alzheimer's and dementia", url: 'https://www.nia.nih.gov/health/alzheimers-and-dementia' },
  { name: 'Cilia et al. 2022, the DARWIN handwriting study', url: 'https://doi.org/10.24432/C55D0K' },
]

export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('tinta-lang')
    if (saved === 'en' || saved === 'es') return saved
  } catch {
    // private mode: fall through to the browser language
  }
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}
