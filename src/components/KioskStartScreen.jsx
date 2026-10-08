import { useEffect, useRef, useState } from "react";
import { KIOSK_RAISED_STYLE, KIOSK_TOP_INSET } from "../utils/kioskLayout";
import sdcaLogo from "../assets/images/sdca-logo-full.png";
import KioskSignage from "./KioskSignage";
import { ARISE_BUTTON as buttonImg, ARISE_LETTERS as LETTERS, LETTER_MS, LOGO_DURATION_MS, TYPE_START_MS } from "../utils/ariseLogoArt";

// The kiosk's attract screen: covers the whole viewport (header and bottom
// whitespace included) until tapped, then fades out. It shows the ARISE logo
// in its neutral form (grey square, red AR button) breathing above "Tap to
// Start"; a tap fades the title and prompt, glides the logo down above the
// subtitle, then plays the logo's animation (frame widens, button slides left,
// A-R-I-S-E types out) and only then hands over to the kiosk session. The
// artwork and timeline are ported from kiosk-startup/ (the mobile app's React
// Native version, shared with DesktopStartScreen via utils/ariseLogoArt.js);
// the keyframes live in index.css, in the designer's SVG units, and must
// stay in step with the timings there. Stays mounted once
// hidden so the fade can play; CSS makes it inert (no pointer events)
// afterwards.
// On tap the title and prompt fade quickly, then the logo glides down to just
// above the subtitle; the logo's own animation starts once it has landed.
// Keep in step with the .kiosk-start-screen-leaving rules in index.css.
const FADE_MS = 250;
const GLIDE_MS = FADE_MS + 600;
const LOGO_SUBTITLE_GAP_PX = 24;
// A moment on the finished logo before the screen fades into the kiosk.
const FINISHED_HOLD_MS = 500;

export default function KioskStartScreen({ hidden, onStart, signageSlides = [], signageSettings = null }) {
  const [phase, setPhase] = useState("idle"); // idle, leaving (glide), playing
  const timer = useRef(null);
  const glideTimer = useRef(null);
  const logoRef = useRef(null);
  const subtitleRef = useRef(null);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(glideTimer.current);
    },
    []
  );

  // Back on the start stage (kiosk idle reset): show the neutral logo again.
  useEffect(() => {
    if (!hidden) return undefined;
    const reset = setTimeout(() => setPhase("idle"), 700);
    return () => clearTimeout(reset);
  }, [hidden]);

  const handleClick = (e) => {
    // Otherwise this button — the whole screen — stays focused after
    // aria-hidden flips true on the next render, which the browser
    // rightly refuses to apply (a focused element can't be hidden
    // from assistive tech) and logs a console warning about.
    e.currentTarget.blur();
    if (phase !== "idle") return;
    const logo = logoRef.current.getBoundingClientRect();
    const subtitle = subtitleRef.current.getBoundingClientRect();
    logoRef.current.style.setProperty("--glide", `${subtitle.top - LOGO_SUBTITLE_GAP_PX - logo.bottom}px`);
    setPhase("leaving");
    glideTimer.current = setTimeout(() => setPhase("playing"), GLIDE_MS);
    timer.current = setTimeout(onStart, GLIDE_MS + LOGO_DURATION_MS + FINISHED_HOLD_MS);
  };

  return (
    <button
      type="button"
      className={
        "kiosk-start-screen" +
        (phase !== "idle" ? " kiosk-start-screen-leaving" : "") +
        (phase === "playing" ? " kiosk-start-screen-playing" : "") +
        (hidden ? " kiosk-start-screen-hidden" : "")
      }
      style={KIOSK_RAISED_STYLE}
      onClick={handleClick}
      tabIndex={hidden ? -1 : 0}
      aria-hidden={hidden}
      aria-label="ARISE, tap to start"
    >
      {/* The SDCA logo exactly where the kiosk header holds it once the tour
          starts, so the two line up as this screen fades out. */}
      <span className="kiosk-start-header" style={{ height: `${KIOSK_TOP_INSET * 100}%` }}>
        <img src={sdcaLogo} alt="" className="kiosk-start-header-logo" draggable="false" />
      </span>
      <span className="kiosk-start-logo-breathe">
        <span className="kiosk-start-logo" ref={logoRef} aria-hidden="true">
          <span className="kiosk-logo-frame" />
          {LETTERS.map((letter, i) => (
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
          <span className="kiosk-logo-dot" />
          <span className="kiosk-logo-cursor" />
          <img className="kiosk-logo-button" src={buttonImg} alt="" draggable="false" />
        </span>
      </span>
      <span className="kiosk-start-title">ARISE</span>
      <span className="kiosk-start-subtitle" ref={subtitleRef}>360° Virtual Map of SDCA</span>
      <span className="kiosk-start-prompt">Tap to Start</span>
      {/* Starting advertisements: a 16:9 rectangle along the bottom, absent
          when none is live. */}
      {signageSlides.length > 0 && (
        <span className="kiosk-start-signage">
          <KioskSignage slides={signageSlides} settings={signageSettings} />
        </span>
      )}
    </button>
  );
}
