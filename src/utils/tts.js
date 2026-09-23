// Thin wrapper around the browser's SpeechSynthesis API, so callers don't
// need to feature-detect or manage utterance state themselves.
export function speak(text, { rate = 1, pitch = 1, volume = 1 } = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = volume;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
