// Tinta's voice: reads instructions aloud and dictates the phone number.
// In the Android app the voice is native, because Android WebView has no speech synthesis.
declare global {
  interface Window {
    TintaNative?: { speak(text: string): void; speakIn?(text: string, lang: string): void }
  }
}

export const canSpeak = Boolean(window.TintaNative) || 'speechSynthesis' in window

export function say(text: string, lang: string) {
  const native = window.TintaNative
  if (native) return native.speakIn ? native.speakIn(text, lang) : native.speak(text)
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.85
  u.lang = lang
  speechSynthesis.cancel()
  speechSynthesis.speak(u)
}
