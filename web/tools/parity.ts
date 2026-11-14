// Does the model in the app give the same numbers as scikit-learn?
// train_export.py saves, for every held-out person, the probabilities computed in Python.
// This runs the real TypeScript from src/lib/model.ts on the same people and compares.
//
//   npm run check:model
import { examples, predict, predictCloser } from '../src/lib/model'
import type { Measures } from '../src/lib/ink'

let worst1 = 0
let worst2 = 0
for (const e of examples) {
  const byTask = e.measures as unknown as Record<number, Measures>
  worst1 = Math.max(worst1, Math.abs(predict(byTask) - e.p1))
  worst2 = Math.max(worst2, Math.abs(predictCloser(byTask).p - e.p2))
}
console.log(`${examples.length} held-out people`)
console.log(`short check: largest difference from Python ${worst1.toFixed(6)}`)
console.log(`closer look: largest difference from Python ${worst2.toFixed(6)}`)
if (worst1 > 1e-3 || worst2 > 1e-3) {
  console.error('The app does not reproduce the Python model.')
  process.exit(1)
}
console.log('OK: the app reproduces the Python model (the saved numbers are rounded to 4 decimals).')
