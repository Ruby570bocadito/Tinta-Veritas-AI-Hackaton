// Every word Tinta says, in English and Spanish.
// English is for the judges; Spanish is for the families who actually try it.
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
  home: { bubble: string; title: string; lead: string; start: string; cases: string; ask: string; chips: string[] }
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
  verdicts: Record<Verdict, { title: string; body: string }>
  nextSteps: Record<Verdict, string[]>
  result: {
    yours: string
    realCase: (i: number, n: number, label: string) => string
    patient: string
    healthy: string
    right: string
    wrong: string
    score: (s: number) => string
    whatNow: string
    measurements: string
    colTask: string
    colSlow: string
    colAir: string
    colTouches: string
    nextCase: string
    mistake: string
    votesUnsure: (s: number) => string
    votesDemo: (s: number) => string
    models: string[]
    restart: string
    home: string
  }
  why: { slowAll: (own: string, usual: string) => string; fastPatient: string; falseAlarm: string }
  note: {
    title: string
    line: (date: string, verdict: string, score: number, closer: boolean) => string
    pace: (pace: string, circle: string, loops: string, phone: string) => string
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
    closer: (a: Record<string, number>, test: number) => string
    device: (s: Record<string, number>, m: Record<string, number>) => string
    limits: string
  }
  study: { title: string; body: string; age: string; choose: string; bands: string[]; copy: string; copied: string }
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
    lead: "A two-minute writing check for early signs of Alzheimer's, on the phone you already have. Built on data from 174 people, 89 of them living with the disease.",
    start: 'Start',
    cases: 'See real cases from the study',
    ask: 'Ask Tinta',
    chips: ['5 short tasks', 'About 2 minutes', 'Works offline'],
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
        title: 'I compare you with yourself',
        body: 'Some people write fast, some slowly, and every phone is different. So I start with two easy warm-ups to learn your own pace, and measure the harder tasks against it. Not against a clock.',
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
    2: { title: 'Warm-up', instruction: 'Join the two dots with a line, back and forth four times, without lifting your finger.' },
    3: { title: 'Warm-up', instruction: 'Now up and down: join the two dots four times, without lifting your finger.' },
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
      'Lovely. That was the first warm-up.',
      'Warm-ups done. Now the real ones.',
      'Nice circles! Two to go.',
      'Almost there. One more.',
      'That is all five. Thank you!',
      'Thank you. Two more.',
      'One more and we are done.',
      'That is everything. Thank you!',
    ],
  },
  closer: {
    title: 'Let me look a little closer',
    body: 'Your pattern sits between the two groups, so I would rather not guess. Three more short tasks, and I will ask two more models for a second opinion.',
    stop: 'Stop here',
    more: 'Three more',
  },
  verdicts: {
    typical: {
      title: 'Within the usual pattern',
      body: 'Compared with your own warm-up pace, the harder tasks slowed you down about as much as the healthy group in the study.',
    },
    unsure: {
      title: "I can't tell from this",
      body: 'Your pattern sits between the two groups, so I would rather not guess. Try again another day, in a calm moment.',
    },
    mention: {
      title: 'Worth mentioning to a doctor',
      body: 'Compared with your own warm-up pace, the harder tasks slowed you down more like the patient group in the study. This is not a diagnosis.',
    },
  },
  nextSteps: {
    typical: ['There is nothing you need to do today.', 'Come back in a few months: the most useful comparison is you against you.'],
    unsure: ['One unclear result means nothing on its own.', 'Try again another day, rested and without hurry.'],
    mention: [
      'Do not worry about a single result: tiredness or a new phone can cause it.',
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
    score: (s) => `Score ${s}/100. Under 35: usual pattern. Over 65: worth mentioning. In between: I don't know.`,
    whatNow: 'What now?',
    measurements: 'See the measurements',
    colTask: 'Task',
    colSlow: 'Slower than own warm-up',
    colAir: 'In the air',
    colTouches: 'Touches',
    nextCase: 'Next case',
    mistake: 'Show a mistake',
    votesUnsure: (s) => `The short check was unsure (${s}/100), so three models looked at all six tasks:`,
    votesDemo: (s) => `Demo mode: the short check was clear (${s}/100), but here is the closer look anyway:`,
    models: ['Straight-line model', 'Nearest-pattern model', 'Forest of small trees'],
    restart: 'Start again',
    home: 'Back to the start',
  },
  why: {
    slowAll: (own, usual) =>
      `This patient was slow on the warm-ups too (${own} against ${usual} for a typical healthy person). Tinta compares people with their own pace, so someone who is slow at everything looks "consistent". That is the price of not depending on the device.`,
    fastPatient: 'This patient wrote the scored tasks at a healthy pace. Timing cannot see everything: other tasks of the full study might have shown it.',
    falseAlarm: 'This healthy person slowed down a lot on the harder tasks, more than most healthy people. A hesitation, a distraction or an unfamiliar task looks the same as a cognitive pause to Tinta.',
  },
  note: {
    title: 'Note for the doctor',
    line: (date, verdict, score, closer) =>
      `${date}. A short writing check done at home on a phone, with a finger. Result: ${verdict} (score ${score}/100${closer ? ', after a closer look with three extra tasks' : ''}).`,
    pace: (pace, circle, loops, phone) =>
      `Warm-up pace: ${pace} per task. Against that pace, the circle took ×${circle}, the loops ×${loops} and the dictated phone number ×${phone}.`,
    about: 'Tinta is a student prototype trained on the public DARWIN dataset (174 people). It is not a medical device and has not been validated with patients on phones. It is meant to start a conversation.',
    print: 'Print or save as PDF',
  },
  history: {
    title: 'You against you',
    first: 'This is your first check on this phone. Come back another day and your line will start to grow.',
    many: (n, last) => `Check number ${n} on this phone. Last time you scored ${last}.`,
    explain: 'One check says little. A line that stays flat, or one that climbs over the months, says much more.',
    clear: 'Forget my history',
    clearConfirm: 'Delete all your past results from this phone?',
  },
  honest: {
    summary: 'How sure can you be? The honest numbers',
    title: 'How well does it work?',
    short: (m, s, train, test) =>
      `Trained on ${train} people, checked on ${test} it never saw (${m.patients} patients, ${m.healthy} healthy). With the short check alone, Tinta missed ${m.missed} patients and raised ${m.false_alarms} false alarms. A plain stopwatch rule missed ${s.missed} and raised ${s.false_alarms}: on the study's own tablet, the stopwatch is slightly better.`,
    closer: (a, test) =>
      `When the short check is unsure, Tinta asks for three more tasks and averages three models. With that closer look (${a.closer_look} of the ${test} needed it), she missed ${a.missed} patients and raised ${a.false_alarms} false alarm${a.false_alarms === 1 ? '' : 's'}, and still said "I can't tell" for ${a.still_unsure}.`,
    device: (s, m) =>
      `But a phone is not that tablet. If a device makes everyone 1.5 times slower, the stopwatch raises ${s.false_alarms} false alarms out of ${s.healthy} healthy people. Tinta still raises ${m.false_alarms}, because it compares you with your own warm-up, not with a clock.`,
    limits: 'Limits: the study used a pen on a tablet, in Italian, and does not publish age or sex, so we cannot check that Tinta works equally well across groups. We have not tested it with patients on a phone. Treat a result as a reason to talk to a doctor, never as an answer.',
  },
  study: {
    title: 'Study mode',
    body: 'Only timings are saved: no name, no drawing. Ask the person first.',
    age: 'Age band',
    choose: 'Choose…',
    bands: ['under 30', '30 to 59', '60 or over'],
    copy: 'Copy timings',
    copied: 'Copied',
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
          'Four simple things in each task: how long your finger is on the screen, how long it is off the screen between strokes, how long the whole task takes, and how many times you touch down.',
          'I never look at what you wrote or how pretty it is. Only at the timing.',
        ],
      },
      {
        q: "Why would handwriting change with Alzheimer's?",
        a: [
          'Writing looks easy but uses a lot of the brain at once: memory, planning, attention and fine movement.',
          'When that gets harder, people hesitate more between strokes. In the study I learned from, people with Alzheimer\'s spent clearly longer with the pen in the air, especially in tasks that need memory, like writing a number they had just heard.',
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
          'No, I cannot know that. I only saw that the harder tasks slowed you down more than usual. Tiredness, nerves, a small screen, poor eyesight or sore hands can do the same.',
          'Out of 17 healthy people I was tested on, I raised a false alarm for a few. So take it as a nudge to mention it at your next appointment, and try again another day.',
        ],
      },
      {
        q: 'How often are you right?',
        a: [
          'About 8 times out of 10 on people I had never seen, in the study data. That means I am wrong about 2 times out of 10, in both directions.',
          'And that study used a pen on a tablet. Nobody has tested me yet with patients on a phone. I say so on every result.',
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
    lead: 'Una prueba de escritura de dos minutos para señales tempranas de alzhéimer, en el móvil que ya tienes. Hecha con datos de 174 personas, 89 de ellas con la enfermedad.',
    start: 'Empezar',
    cases: 'Ver casos reales del estudio',
    ask: 'Pregunta a Tinta',
    chips: ['5 tareas cortas', 'Unos 2 minutos', 'Funciona sin internet'],
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
        title: 'Te comparo contigo',
        body: 'Hay quien escribe rápido y quien escribe despacio, y cada móvil es distinto. Por eso empiezo con dos ejercicios fáciles para conocer tu ritmo, y mido las tareas difíciles contra él. No contra un reloj.',
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
    2: { title: 'Calentamiento', instruction: 'Une los dos puntos con una línea, ida y vuelta cuatro veces, sin levantar el dedo.' },
    3: { title: 'Calentamiento', instruction: 'Ahora de arriba abajo: une los dos puntos cuatro veces, sin levantar el dedo.' },
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
      'Muy bien. Ese era el primer calentamiento.',
      'Calentamiento hecho. Ahora las de verdad.',
      '¡Bonitos círculos! Quedan dos.',
      'Ya casi. Una más.',
      'Ya están las cinco. ¡Gracias!',
      'Gracias. Dos más.',
      'Una más y terminamos.',
      'Eso es todo. ¡Gracias!',
    ],
  },
  closer: {
    title: 'Déjame mirar un poco mejor',
    body: 'Tu patrón queda entre los dos grupos, y prefiero no adivinar. Tres tareas cortas más, y pediré una segunda opinión a otros dos modelos.',
    stop: 'Lo dejo aquí',
    more: 'Tres más',
  },
  verdicts: {
    typical: {
      title: 'Dentro de lo habitual',
      body: 'Comparadas con tu propio ritmo, las tareas difíciles te frenaron más o menos lo mismo que al grupo sano del estudio.',
    },
    unsure: {
      title: 'Con esto no lo sé',
      body: 'Tu patrón queda entre los dos grupos, y prefiero no adivinar. Prueba otro día, en un momento tranquilo.',
    },
    mention: {
      title: 'Coméntalo con tu médico',
      body: 'Comparadas con tu propio ritmo, las tareas difíciles te frenaron de una forma más parecida al grupo de pacientes del estudio. Esto no es un diagnóstico.',
    },
  },
  nextSteps: {
    typical: ['Hoy no tienes que hacer nada.', 'Vuelve dentro de unos meses: la comparación más útil es contigo.'],
    unsure: ['Un resultado dudoso, él solo, no significa nada.', 'Prueba otro día, con calma y sin prisa.'],
    mention: [
      'No te preocupes por un solo resultado: el cansancio o un móvil nuevo pueden causarlo.',
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
    score: (s) => `Nota ${s}/100. Menos de 35: lo habitual. Más de 65: coméntalo. En medio: no lo sé.`,
    whatNow: '¿Y ahora qué?',
    measurements: 'Ver las medidas',
    colTask: 'Tarea',
    colSlow: 'Más lento que tu ritmo',
    colAir: 'En el aire',
    colTouches: 'Toques',
    nextCase: 'Otro caso',
    mistake: 'Ver un fallo',
    votesUnsure: (s) => `La prueba corta no lo tenía claro (${s}/100), así que tres modelos miraron las seis tareas:`,
    votesDemo: (s) => `Modo demostración: la prueba corta era clara (${s}/100), pero aquí va la segunda mirada:`,
    models: ['Modelo de línea recta', 'Modelo de parecidos', 'Bosque de arbolitos'],
    restart: 'Empezar otra vez',
    home: 'Volver al principio',
  },
  why: {
    slowAll: (own, usual) =>
      `Este paciente también fue lento en el calentamiento (${own} frente a ${usual} de una persona sana típica). Tinta compara a cada uno con su propio ritmo, así que alguien lento en todo parece «constante». Es el precio de no depender del aparato.`,
    fastPatient: 'Este paciente hizo las tareas puntuadas a un ritmo sano. El tiempo no lo ve todo: otras tareas del estudio completo quizá lo habrían mostrado.',
    falseAlarm: 'Esta persona sana se frenó mucho en las tareas difíciles, más que la mayoría. Una duda, un despiste o una tarea poco conocida se parecen, para Tinta, a una pausa cognitiva.',
  },
  note: {
    title: 'Nota para el médico',
    line: (date, verdict, score, closer) =>
      `${date}. Prueba corta de escritura hecha en casa con el dedo, en un móvil. Resultado: ${verdict} (nota ${score}/100${closer ? ', tras una segunda mirada con tres tareas más' : ''}).`,
    pace: (pace, circle, loops, phone) =>
      `Ritmo de calentamiento: ${pace} por tarea. Respecto a ese ritmo, el círculo llevó ×${circle}, los bucles ×${loops} y el teléfono dictado ×${phone}.`,
    about: 'Tinta es un prototipo de estudiante entrenado con el conjunto público DARWIN (174 personas). No es un producto sanitario y no se ha validado con pacientes en móviles. Sirve para empezar una conversación.',
    print: 'Imprimir o guardar en PDF',
  },
  history: {
    title: 'Tú contra ti',
    first: 'Es tu primera prueba en este móvil. Vuelve otro día y tu línea empezará a crecer.',
    many: (n, last) => `Prueba número ${n} en este móvil. La última vez sacaste un ${last}.`,
    explain: 'Una sola prueba dice poco. Una línea que se mantiene, o que sube con los meses, dice mucho más.',
    clear: 'Olvidar mi historial',
    clearConfirm: '¿Borrar todos tus resultados anteriores de este móvil?',
  },
  honest: {
    summary: '¿Cuánto te puedes fiar? Los números, sin adornos',
    title: '¿Cómo de bien funciona?',
    short: (m, s, train, test) =>
      `Entrenada con ${train} personas y comprobada con ${test} que nunca había visto (${m.patients} pacientes, ${m.healthy} sanas). Solo con la prueba corta, a Tinta se le escaparon ${m.missed} pacientes y dio ${m.false_alarms} falsas alarmas. Una regla de cronómetro falló con ${s.missed} y dio ${s.false_alarms}: en la tableta del estudio, el cronómetro es un poco mejor.`,
    closer: (a, test) =>
      `Cuando la prueba corta duda, Tinta pide tres tareas más y hace la media de tres modelos. Con esa segunda mirada (la necesitaron ${a.closer_look} de las ${test}), se le escaparon ${a.missed} pacientes, dio ${a.false_alarms} falsa${a.false_alarms === 1 ? '' : 's'} alarma${a.false_alarms === 1 ? '' : 's'} y siguió diciendo «no lo sé» en ${a.still_unsure}.`,
    device: (s, m) =>
      `Pero un móvil no es esa tableta. Si un aparato hace a todo el mundo 1,5 veces más lento, el cronómetro da ${s.false_alarms} falsas alarmas entre ${s.healthy} personas sanas. Tinta sigue dando ${m.false_alarms}, porque te compara con tu propio calentamiento y no con un reloj.`,
    limits: 'Límites: el estudio se hizo con lápiz sobre una tableta, en italiano, y no publica edad ni sexo, así que no podemos comprobar que Tinta funcione igual de bien en todos los grupos. No se ha probado con pacientes en un móvil. Toma el resultado como un motivo para hablar con un médico, nunca como una respuesta.',
  },
  study: {
    title: 'Modo estudio',
    body: 'Solo se guardan tiempos: ni nombre ni dibujo. Pregunta antes a la persona.',
    age: 'Franja de edad',
    choose: 'Elige…',
    bands: ['menos de 30', 'de 30 a 59', '60 o más'],
    copy: 'Copiar tiempos',
    copied: 'Copiado',
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
          'Cuatro cosas sencillas en cada tarea: cuánto tiempo está tu dedo en la pantalla, cuánto está levantado entre trazo y trazo, cuánto dura la tarea entera y cuántas veces apoyas el dedo.',
          'Nunca miro qué has escrito ni si queda bonito. Solo los tiempos.',
        ],
      },
      {
        q: '¿Por qué cambia la escritura con el alzhéimer?',
        a: [
          'Escribir parece fácil, pero usa mucho cerebro a la vez: memoria, planificación, atención y movimiento fino.',
          'Cuando eso cuesta más, la persona duda más entre trazo y trazo. En el estudio del que aprendí, las personas con alzhéimer pasaban claramente más tiempo con el lápiz en el aire, sobre todo en tareas que piden memoria, como escribir un número que acaban de oír.',
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
          'No, eso no puedo saberlo. Solo he visto que las tareas difíciles te frenaron más de lo habitual. El cansancio, los nervios, una pantalla pequeña, ver mal o tener las manos doloridas pueden hacer lo mismo.',
          'De 17 personas sanas con las que me probaron, a unas pocas les di una falsa alarma. Tómalo como un empujón para comentarlo en tu próxima cita, y repítelo otro día.',
        ],
      },
      {
        q: '¿Cuántas veces aciertas?',
        a: [
          'Unas 8 de cada 10 con personas que no había visto nunca, en los datos del estudio. O sea, me equivoco unas 2 de cada 10, en los dos sentidos.',
          'Y ese estudio se hizo con lápiz y tableta. Nadie me ha probado todavía con pacientes en un móvil. Lo digo en cada resultado.',
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
