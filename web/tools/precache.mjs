// After the build: write the list of every file of the app, for the service worker (public/sw.js) to keep on the phone.
//   node tools/precache.mjs        (run by `npm run build`)
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const files = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path)
    else files.push(relative(dist, path).replaceAll('\\', '/'))
  }
}
walk(dist)
// "./" is the page itself; the list and the worker are fetched on their own.
const list = ['./', ...files.filter((f) => f !== 'precache.json' && f !== 'sw.js')]
if (list.some((f) => f.startsWith('..') || f.includes(':'))) throw new Error('a path points outside the app: ' + list.find((f) => f.startsWith('..') || f.includes(':')))
writeFileSync(join(dist, 'precache.json'), JSON.stringify(list))
console.log(`precache.json: ${list.length} files kept for offline use`)
