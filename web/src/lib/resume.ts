// A check that survives a reload.
//
// Two minutes is long enough for a phone call, for a pull on the screen that reloads the page, or for a
// browser that throws a background tab away. Without this file, coming back meant starting from the first
// task. What was written is kept in sessionStorage: it stays on this device, in this tab, and it is gone
// when the tab is closed or the check is started again.
//
// Only finished tasks are kept. A task that was half written starts again: the clock of a page starts from
// zero when it reloads, so the two halves could not be timed together.
import type { Stroke } from './ink'
import { EXTRA_IDS, TASK_IDS, WARMUP_IDS } from './model'

export type Sheet = { w: number; h: number }

/** The screens of the check itself. Nothing is kept on the others (start, guide, real cases, the free sheet). */
export type Place = { name: 'task'; index: number; review: boolean } | { name: 'closer' } | { name: 'result' }

export type Progress = {
  place: Place
  ink: Record<number, Stroke[]>
  sheets: Record<number, Sheet>
  closer: boolean
  tries: Record<number, number>
  warned: Record<number, string>
  redo: number[]
}

const KEY = 'tinta-check'
const VERSION = 1
/** After half an hour away it is fairer to start again than to join two sittings. */
export const KEEP_MS = 30 * 60 * 1000

const KNOWN = new Set([...WARMUP_IDS, ...TASK_IDS, ...EXTRA_IDS])
const SHORT = WARMUP_IDS.length + TASK_IDS.length
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The check as text. Points are stored as [x, y, t], exactly as they were measured. */
export function pack(progress: Progress, now: number): string {
  const ink: Record<string, number[][][]> = {}
  for (const [id, strokes] of Object.entries(progress.ink)) ink[id] = strokes.map((s) => s.map((p) => [p.x, p.y, p.t]))
  return JSON.stringify({ v: VERSION, at: now, ...progress, ink })
}

/**
 * The check back from text, or null when it is missing, too old, from another version, or damaged in any way.
 * `order` is the task behind each screen of the check: the short check first, then the closer look.
 */
export function unpack(text: string | null, now: number, order: number[]): Progress | null {
  if (!text) return null
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (!record(raw) || raw.v !== VERSION || !finite(raw.at) || raw.at > now || now - raw.at > KEEP_MS) return null
  if (typeof raw.closer !== 'boolean' || !record(raw.ink) || !record(raw.sheets) || !record(raw.tries) || !record(raw.warned)) return null

  const screens = SHORT + (raw.closer ? EXTRA_IDS.length : 0)
  if (order.length < screens) return null

  const place = raw.place
  if (!record(place)) return null
  let at: Place
  if (place.name === 'task') {
    if (!Number.isInteger(place.index) || (place.index as number) < 0 || (place.index as number) >= screens || typeof place.review !== 'boolean') return null
    at = { name: 'task', index: place.index as number, review: place.review }
  } else if (place.name === 'closer' || place.name === 'result') {
    at = { name: place.name }
  } else {
    return null
  }

  const ink: Record<number, Stroke[]> = {}
  for (const [key, strokes] of Object.entries(raw.ink)) {
    const id = Number(key)
    if (!KNOWN.has(id) || !Array.isArray(strokes)) return null
    const back: Stroke[] = []
    for (const s of strokes) {
      if (!Array.isArray(s)) return null
      const stroke: Stroke = []
      for (const p of s) {
        if (!Array.isArray(p) || p.length !== 3 || !p.every(finite)) return null
        stroke.push({ x: p[0], y: p[1], t: p[2] })
      }
      back.push(stroke)
    }
    ink[id] = back
  }
  // The task on the screen had not been finished: it starts again with an empty sheet.
  if (at.name === 'task' && !at.review) delete ink[order[at.index]]

  const sheets: Record<number, Sheet> = {}
  for (const [key, s] of Object.entries(raw.sheets)) {
    if (!KNOWN.has(Number(key)) || !record(s) || !finite(s.w) || !finite(s.h) || s.w <= 0 || s.h <= 0) return null
    sheets[Number(key)] = { w: s.w, h: s.h }
  }
  const tries: Record<number, number> = {}
  for (const [key, n] of Object.entries(raw.tries)) {
    if (!KNOWN.has(Number(key)) || !Number.isInteger(n) || (n as number) < 0) return null
    tries[Number(key)] = n as number
  }
  const warned: Record<number, string> = {}
  for (const [key, kind] of Object.entries(raw.warned)) {
    if (!KNOWN.has(Number(key)) || typeof kind !== 'string') return null
    warned[Number(key)] = kind
  }
  const redo = raw.redo
  if (!Array.isArray(redo) || !redo.every((id) => KNOWN.has(id))) return null

  return { place: at, ink, sheets, closer: raw.closer, tries, warned, redo: redo as number[] }
}

// A browser in private mode, or with storage switched off, simply does not keep the check: nothing else changes.
export function loadProgress(order: number[]): Progress | null {
  try {
    const text = sessionStorage.getItem(KEY)
    const progress = unpack(text, Date.now(), order)
    if (text && !progress) sessionStorage.removeItem(KEY) // too old or damaged: it is not kept any longer
    return progress
  } catch {
    return null
  }
}

export function saveProgress(progress: Progress) {
  try {
    sessionStorage.setItem(KEY, pack(progress, Date.now()))
  } catch {
    // no room, or no storage at all: a reload will start from the beginning, as it did before
  }
}

export function clearProgress() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // nothing was kept
  }
}
