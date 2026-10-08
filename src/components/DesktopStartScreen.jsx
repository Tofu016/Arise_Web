import { useEffect, useState } from "react";
import { ARISE_BUTTON, ARISE_LETTERS, LETTER_MS, LOGO_DURATION_MS, TYPE_START_MS } from "../utils/ariseLogoArt";
import sdcaLogo from "../assets/images/sdca-logo-full.png";

// The desktop web app's startup screen. It opens like a film's studio card —
// the SDCA logo with "presents" under it fades in, holds, and fades out —
// then the kiosk start screen's ARISE logo
// animation (frame widens, button slides left, A-R-I-S-E types out), played
// on its own the moment the page opens — no tap — while the campus loads
// underneath. Once the logo has finished AND the page is ready (`ready`),
// it fades out and calls onDone. If loading takes longer than the logo, a
// small "Loading campus…" line appears under the finished logo.
//
// Smooth while the page loads: the campus data, the 3D viewer and the first
// panorama all land on the main thread during this animation, so it moves
// nothing that needs layout. The frame is three pieces — two rounded ends
// that slide and a middle that stretches (scaleX) — and everything else
// only translates or fades, all of which the browser runs on the compositor.
// (The kiosk's own version animates left/width, which is fine on a screen
// that waits for a tap with nothing loading.) The logo also stays centred:
// it's pinned to the screen's middle with the text hung below it, and slides
// so the starting square — not the expanded logo's box — is what's centred.
//
// Shown once per page load (MainPage hosts it above the per-session
// remount), on the desktop layout only; the kiosk keeps its tap-to-start
// KioskStartScreen, and the phone-sized Mobile web layout its own loading
// screen. Artwork and timings: utils/ariseLogoArt.js; keyframes: the
// .desktop-start-* rules in index.css (in the designer's SVG units).
//
//   <DesktopStartScreen ready={pageReady} onDone={() => …} />
//
// Once all the artwork is decoded (so nothing pops in mid-animation):
//   SDCA presents — fades in, holds, fades out (PRESENT_*; keep in step with
//     the .desktop-start-presents rules in index.css);
//   the neutral ARISE square fades in (APPEAR_MS), and the logo plays;
//   a moment on the finished logo, and the fade out (keep FADE_MS in step
//     with .desktop-start-screen-leaving).
const PRESENT_IN_MS = 600;
const PRESENT_HOLD_MS = 1000;
const PRESENT_OUT_MS = 450;
const APPEAR_MS = 250;
const FINISHED_HOLD_MS = 600;
const FADE_MS = 600;
// Never hold the screen back for slow images longer than this.
const DECODE_TIMEOUT_MS = 1500;

function decodeArtwork() {
  const srcs = [sdcaLogo, ARISE_BUTTON, ...ARISE_LETTERS.map((l) => l.src)];
  const decodes = srcs.map((src) => {
    const img = new Image();
    img.src = src;
    return img.decode().catch(() => {});
  });
  return Promise.race([Promise.all(decodes), new Promise((r) => setTimeout(r, DECODE_TIMEOUT_MS))]);
}

export default function DesktopStartScreen({ ready, onDone }) {
  // decoding -> presenting (SDCA presents) -> handoff (it fades out) ->
  // shown (neutral square fades in) -> playing -> (logoDone)
  const [phase, setPhase] = useState("decoding");
  const [logoDone, setLogoDone] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timers = [];
    // decodeArtwork never rejects (each decode swallows its own failure).
    void decodeArtwork().then(() => {
      if (cancelled) return;
      const handoffAt = PRESENT_IN_MS + PRESENT_HOLD_MS;
      const shownAt = handoffAt + PRESENT_OUT_MS;
      const playAt = shownAt + APPEAR_MS;
      setPhase("presenting");
      timers.push(
        setTimeout(() => setPhase("handoff"), handoffAt),
        setTimeout(() => setPhase("shown"), shownAt),
        setTimeout(() => setPhase("playing"), playAt),
        setTimeout(() => setLogoDone(true), playAt + LOGO_DURATION_MS + FINISHED_HOLD_MS)
      );
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (!logoDone || !ready) return undefined;
    const startFade = setTimeout(() => setLeaving(true), 0);
    const done = setTimeout(() => onDone?.(), FADE_MS);
    return () => {
      clearTimeout(startFade);
      clearTimeout(done);
    };
  }, [logoDone, ready, onDone]);

  return (
    <div
      className={
        "desktop-start-screen" +
        (phase === "presenting" ? " desktop-start-presenting" : "") +
        (phase === "shown" || phase === "playing" ? " desktop-start-shown" : "") +
        (phase === "playing" ? " desktop-start-playing" : "") +
        (leaving ? " desktop-start-screen-leaving" : "")
      }
      role="status"
      aria-label="ARISE is loading"
    >
      {/* The studio card: SDCA presents. Centred over the same spot. */}
      <span className="desktop-start-presents" aria-hidden="true">
        <img src={sdcaLogo} alt="" className="desktop-start-presents-logo" draggable="false" />
        <span className="desktop-start-presents-text">presents</span>
      </span>

      <span className="desktop-start-logo" aria-hidden="true">
        <span className="dsl-mid" />
        <span className="dsl-cap dsl-cap-left" />
        <span className="dsl-cap dsl-cap-right" />
        {ARISE_LETTERS.map((letter, i) => (
          <img
            key={i}
            className="kiosk-logo-letter"
            src={letter.src}
            alt=""
            draggable="false"
            style={{
              "--l": letter.box[0],
              "--t": letter.box[1],
              "--w": letter.box[2],
              "--h": letter.box[3],
              "--delay": `${TYPE_START_MS + i * LETTER_MS}ms`,
            }}
          />
        ))}
        <span className="dsl-dot" />
        <span className="dsl-cursor">
          <span className="dsl-cursor-ink" />
        </span>
        <img className="dsl-button" src={ARISE_BUTTON} alt="" draggable="false" />

        {/* Hung below the logo, so the logo itself is what's centred. */}
        <span className="desktop-start-below">
          <span className="desktop-start-subtitle">360° Virtual Map of SDCA</span>
          <span className={"desktop-start-loading" + (logoDone && !ready ? " desktop-start-loading-shown" : "")}>
            Loading campus…
          </span>
        </span>
      </span>
    </div>
  );
}
