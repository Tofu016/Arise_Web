// Thin wrapper for one-shot sound effects. Reuses a single Audio element per
// src. A play request made while the clip is still under RETRIGGER_THRESHOLD
// of its length is dropped outright — not queued or deferred — so a burst of
// quick re-triggers (e.g. sliding across several stars) doesn't stutter the
// clip; only a request made after that point restarts it.
const RETRIGGER_THRESHOLD = 0.25;
const cache = new Map();

export function playSfx(src, { volume = 1 } = {}) {
  if (typeof Audio === "undefined") return;
  let audio = cache.get(src);
  if (!audio) {
    audio = new Audio(src);
    cache.set(src, audio);
  }
  const isPlaying = !audio.paused && !audio.ended;
  const progress = audio.duration ? audio.currentTime / audio.duration : 1;
  if (isPlaying && progress < RETRIGGER_THRESHOLD) return;
  audio.volume = volume;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}
