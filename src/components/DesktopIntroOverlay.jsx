import { useEffect, useRef } from "react";
import sdcaLogoReversedWhite from "../assets/images/sdca-logo-reversed-white.png";
import HotspotGlyph from "./HotspotGlyph";
import { DESKTOP_INTRO_TEXT } from "../utils/introScript";

// Hand-drawn (not sourced) since nothing this specific exists in the icon
// set or the grey/white pairs: a mouse body with one button highlighted to
// show which click does what, reused for both the drag and the scroll
// instruction with a different part of the same base shape lit up.
function MouseIcon({ highlight }) {
  return (
    <svg className="intro-mouse-icon" viewBox="0 0 40 60" aria-hidden="true">
      <rect x="3" y="2" width="34" height="56" rx="17" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <line x1="20" y1="2" x2="20" y2="19" stroke="currentColor" strokeWidth="2" />
      {highlight === "left" && (
        // The rect above is drawn with rx = half its width (17 = 34/2), so
        // its top-left corner is a full quarter circle of that same
        // radius, centered at (20,19), meeting the top-right corner
        // exactly at the top-center point (20,2) — this traces that exact
        // arc (not an approximation) so the white fill reaches all the way
        // to the stroke on every edge, with no sliver of gap left uncovered.
        <path
          className="intro-mouse-highlight"
          d="M20 2 A17 17 0 0 0 3 19 L20 19 Z"
          fill="var(--white)"
        />
      )}
      {highlight === "scroll" && (
        <rect className="intro-mouse-highlight intro-mouse-wheel" x="17" y="10" width="6" height="14" rx="3" fill="var(--white)" />
      )}
    </svg>
  );
}

// A generic cursor arrow, animated tapping the real-looking hotspot (see
// HotspotGlyph) to read as "click this glowing spot in the photo" without
// needing a real panorama screenshot behind it. The arrow's tip lands on the
// disc's lower-right edge, off-center, so it doesn't hide the chevron.
function HotspotClickIcon() {
  return (
    <svg className="intro-hotspot-icon" viewBox="0 0 60 60" aria-hidden="true">
      <HotspotGlyph cx={27} cy={26} />
      <path
        className="intro-hotspot-cursor"
        d="M34 34 L34 50 L38 47 L41.5 55 L45 53.5 L41.5 46 L48 46 Z"
        fill="var(--white)"
        stroke="var(--ink)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// A single physical keyboard key, drawn rather than sourced (the app's
// existing "key.svg" is a house-key glyph, not a keycap) so WASD/Shift/Ctrl
// can share one consistent look.
function KeyCap({ label, wide }) {
  return <span className={"intro-keycap" + (wide ? " intro-keycap-wide" : "")}>{label}</span>;
}

// Full-screen, session-start walkthrough for the desktop (non-kiosk) view.
// Unlike per-button callouts, which point at specific
// on-screen buttons one at a time, this is a single upfront splash covering
// the panorama's own mouse/keyboard controls, dismissed by a click anywhere
// (or Escape) rather than a per-tip "Got it". Deliberately not persisted,
// same reasoning as KioskIntroOverlay: every fresh page load is a new
// visitor's first impression, so it shows again on its own.
export default function DesktopIntroOverlay({ open, onDismiss }) {
  const ref = useRef(null);

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  // Moving forward is the overlay's own advertised keyboard action, so doing
  // it counts as having read the instructions. A window listener because the
  // overlay only has focus until the visitor clicks elsewhere; the key still
  // reaches the panorama's keyboard nav, so the move happens too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="desktop-intro-overlay"
      role="button"
      aria-label="How to move around this tour. Click anywhere to begin."
      onClick={onDismiss}
      onKeyDown={(e) => e.key === "Escape" && onDismiss()}
      tabIndex={-1}
    >
      <img src={sdcaLogoReversedWhite} alt="St. Dominic College of Asia" className="desktop-intro-logo" />

      {/* Each column's icon sits in a fixed-height holder (desktop-intro-icon)
          regardless of the icon's own natural size, so every column's text
          starts at the same y — see .desktop-intro-icon. */}
      <div className="desktop-intro-tips">
        <div className="desktop-intro-tip">
          <div className="desktop-intro-icon">
            <MouseIcon highlight="left" />
          </div>
          <p>{DESKTOP_INTRO_TEXT.drag}</p>
        </div>
        <div className="desktop-intro-tip">
          <div className="desktop-intro-icon">
            <HotspotClickIcon />
          </div>
          <p>{DESKTOP_INTRO_TEXT.hotspot}</p>
        </div>
        <div className="desktop-intro-tip">
          <div className="desktop-intro-icon">
            <MouseIcon highlight="scroll" />
          </div>
          <p>{DESKTOP_INTRO_TEXT.zoom}</p>
        </div>
      </div>

      <p className="desktop-intro-or">OR</p>

      <div className="desktop-intro-keys">
        <div className="desktop-intro-key-group">
          <div className="desktop-intro-icon">
            <div className="desktop-intro-key-cluster">
              <KeyCap label="W" />
              <div className="desktop-intro-key-row">
                <KeyCap label="A" />
                <KeyCap label="S" />
                <KeyCap label="D" />
              </div>
            </div>
          </div>
          <p>{DESKTOP_INTRO_TEXT.wasd}</p>
        </div>
        <div className="desktop-intro-key-group">
          <div className="desktop-intro-icon">
            <div className="desktop-intro-key-row">
              <KeyCap label="Shift" wide />
              <KeyCap label="Ctrl" wide />
            </div>
          </div>
          <p>{DESKTOP_INTRO_TEXT.shiftCtrl}</p>
        </div>
      </div>

      <p className="desktop-intro-dismiss">Click anywhere to begin</p>
    </div>
  );
}
