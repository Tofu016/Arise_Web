import { useEffect, useRef } from "react";
import { MouseIcon, HotspotClickIcon } from "./DesktopIntroOverlay";
import { useIsCoarsePointer } from "./panorama/useIsCoarsePointer";
import { TOUR_INTRO_TEXT } from "../utils/introScript";
import menuWhite from "../assets/icons/menu-white.svg";

// A finger in place of the mouse, for touch screens: the same "drag here"
// idea, drawn to match MouseIcon's line weight.
function TouchDragIcon() {
  return (
    <svg className="tour-tutorial-touch-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path
        d="M19 30V13a3 3 0 0 1 6 0v11l8.2 1.6a3.5 3.5 0 0 1 2.8 3.9L34.8 38a4 4 0 0 1-4 3.5H23a5 5 0 0 1-4-2l-6-8a3 3 0 0 1 4.6-3.8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path className="tour-tutorial-swipe" d="M6 8h12M30 8h12M10 4 6 8l4 4M38 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// The tour's own round buttons, drawn small, so each tip shows the thing
// it's about.
function ScenesButtonIcon() {
  return (
    <span className="tour-tutorial-btn tour-tutorial-btn-panel" aria-hidden="true">
      <img src={menuWhite} alt="" />
    </span>
  );
}

function StepButtonsIcon() {
  const chevron = (points) => (
    <span className="tour-tutorial-btn tour-tutorial-btn-light">
      <svg viewBox="0 0 24 24">
        <polyline points={points} />
      </svg>
    </span>
  );
  return (
    <span className="tour-tutorial-btn-pair" aria-hidden="true">
      {chevron("15 18 9 12 15 6")}
      {chevron("9 18 15 12 9 6")}
    </span>
  );
}

// The public tour's controls screen: shown after Enter on every visit (each
// page load is a new visitor, as on the main page — not remembered), and
// again from the ? button. One overlay, four tips — look around, hotspots,
// the scene list, previous / next — dismissed by a click or tap anywhere,
// or Escape. Styled with the main page's DesktopIntroOverlay classes, so
// the two read as one family.
export default function TourTutorialOverlay({ open, onDismiss }) {
  const ref = useRef(null);
  const touch = useIsCoarsePointer();

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  if (!open) return null;

  const tips = [
    { key: "drag", icon: touch ? <TouchDragIcon /> : <MouseIcon highlight="left" />, text: touch ? TOUR_INTRO_TEXT.dragTouch : TOUR_INTRO_TEXT.drag },
    { key: "hotspot", icon: <HotspotClickIcon />, text: touch ? TOUR_INTRO_TEXT.hotspotTouch : TOUR_INTRO_TEXT.hotspot },
    { key: "scenes", icon: <ScenesButtonIcon />, text: TOUR_INTRO_TEXT.scenes },
    { key: "step", icon: <StepButtonsIcon />, text: TOUR_INTRO_TEXT.step },
  ];

  return (
    <div
      ref={ref}
      className="desktop-intro-overlay tour-tutorial"
      role="button"
      aria-label={`How to use this tour. ${tips.map((t) => t.text).join(" ")} ${touch ? "Tap" : "Click"} anywhere to begin.`}
      onClick={onDismiss}
      onKeyDown={(e) => (e.key === "Escape" || e.key === "Enter" || e.key === " ") && onDismiss()}
      tabIndex={-1}
    >
      <h2 className="tour-tutorial-title">How to explore</h2>

      {/* Each tip's icon sits in the same fixed-height holder
          (.desktop-intro-icon), so every column's text starts at the same y. */}
      <div className="desktop-intro-tips tour-tutorial-tips">
        {tips.map((t) => (
          <div key={t.key} className="desktop-intro-tip">
            <div className="desktop-intro-icon">{t.icon}</div>
            <p>{t.text}</p>
          </div>
        ))}
      </div>

      <p className="tour-tutorial-help">{TOUR_INTRO_TEXT.help}</p>
      <p className="desktop-intro-dismiss">{touch ? "Tap" : "Click"} anywhere to begin</p>
    </div>
  );
}
