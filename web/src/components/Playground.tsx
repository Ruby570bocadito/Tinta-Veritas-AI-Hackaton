import { useState } from 'react'
import type { Measures } from '../lib/ink'
import { AIR_FLOOR, TASK_IDS, airShare, isGrey, onScale, predict, verdict } from '../lib/model'
import type { Strings } from '../lib/strings'
import Mascot from './Mascot'

// "See how I decide": two sliders and the real model.
// The made-up person lifts the finger the same number of times in each of the three scored tasks and waits
// the same time at each lift. Real writing is never that even, so this shows how the model reacts, not how
// anyone writes. The seconds on the screen are the middle values of our own phone volunteers.
const ON_SCREEN: Record<number, number> = { 5: 5.7, 9: 5.5, 16: 3.3 }

export default function Playground({ t }: { t: Strings }) {
  const [lifts, setLifts] = useState(2)
  const [pause, setPause] = useState(0.4)

  const byTask: Record<number, Measures> = {}
  for (const id of TASK_IDS) {
    const paper = 1000 * ON_SCREEN[id]
    const air = 1000 * lifts * pause
    byTask[id] = { air_time: air, paper_time: paper, total_time: paper + air, num_of_pendown: lifts + 1 }
  }
  // The same rule as the real check: less time in the air on the word than anyone in the study had means no result.
  const tooLittle = TASK_IDS.some((id) => AIR_FLOOR[id] !== undefined && airShare(byTask[id]) < AIR_FLOOR[id])
  const p = predict(byTask)
  const points = onScale(p)
  const share = Math.round((100 * TASK_IDS.reduce((sum, id) => sum + airShare(byTask[id]), 0)) / TASK_IDS.length)

  return (
    <section className="honest lab">
      <div className="lab-head">
        <Mascot mood="think" size={84} />
        <h2>{t.lab.title}</h2>
      </div>
      <p>{t.lab.lead}</p>
      <label className="field">
        {t.lab.lifts(lifts)}
        <input type="range" min={0} max={12} step={1} value={lifts} onChange={(e) => setLifts(Number(e.target.value))} />
      </label>
      <label className="field">
        {t.lab.pause(pause)}
        <input type="range" min={0.1} max={3} step={0.1} value={pause} onChange={(e) => setPause(Number(e.target.value))} />
      </label>
      {tooLittle ? (
        <p className="lab-answer" role="status">
          <b>{t.result.noResultTitle}.</b> {t.lab.none}
        </p>
      ) : (
        <div role="status">
          <div className="meter" aria-hidden="true">
            <div className="meter-pin live" style={{ left: `${points}%` }} />
          </div>
          <p className="lab-answer">
            <b className={'verdict ' + verdict(p)}>{t.verdicts[verdict(p)].title}</b> · {t.lab.at(points)}
          </p>
          <p className="fine">
            {t.lab.share(share)} {isGrey(p) ? t.lab.grey : ''}
          </p>
        </div>
      )}
      {/* Said in a box, right under the answer: these sliders are not a target to aim for. */}
      <p className="why">{t.lab.note}</p>
    </section>
  )
}
