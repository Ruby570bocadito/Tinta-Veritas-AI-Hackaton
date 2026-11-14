// "You against you": past results, kept only on this phone (localStorage). Nothing is uploaded.
import type { Verdict } from './model'

export type Entry = { t: number; score: number; verdict: Verdict; closer: boolean }

const KEY = 'tinta-history'

export function loadHistory(): Entry[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function addToHistory(entry: Entry): Entry[] {
  const list = [...loadHistory(), entry].slice(-24)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // storage unavailable (private mode): the check still works, it just is not remembered
  }
  return list
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing to clear
  }
}

// Study mode: the timings of each volunteer, kept on this phone until they are copied out by hand.
const PEOPLE = 'tinta-study'

export function loadPeople(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(PEOPLE) ?? '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function savePeople(list: string[]) {
  try {
    localStorage.setItem(PEOPLE, JSON.stringify(list))
  } catch {
    // storage unavailable: the line can still be copied one by one
  }
}
