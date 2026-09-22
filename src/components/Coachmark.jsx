import { useEffect, useId, useState } from "react";
import { KIOSK_CARD_CENTER } from "../utils/kioskLayout";

const BOX_HALF_WIDTH = 130; // half of .coachmark-pointer's max-width (260px) — the callout's true rendered footprint
// The desktop's left-edge button column (menu, directions, feedback, the
// minimap) is only ~60px wide, but centering a 260px-wide callout on a
// button that close to the edge would still overlap the rest of that
// column — so the callout's center is kept at least this far from the
// left edge specifically, clear of the whole column, not just the one
// button it's pointing at.
const LEFT_EDGE_MARGIN = 220;
// align="left" (the desktop menu button — the floating search bar sits
// immediately to its right, at the same top:16px row, so centering the
// callout over the button like the default would send its arrow straight
// through the search bar): pins the callout to a fixed padding from the
// screen's left edge instead of centering it over the target at all.
const LEFT_STICK_PADDING = 24;
const LEFT_STICK_ARROW_X = LEFT_STICK_PADDING + 50; // where along that pinned callout the arrow anchors
const LEFT_STICK_GAP = 64; // further down than the default GAP, clear of the search bar's own row
const GAP = 28; // space between the callout/target and the arrow drawn between them
const ARROW_PADDING = 6; // the arrow itself stops short of both ends, within that gap, rather than touching either
const BOX_HEIGHT_GUESS = 110; // rough height of a one/two-line callout, just for the above/below fit check

// A one-time first-run tip, in one of two shapes — never dims the screen,
// so whatever it's pointing at (or anything else) stays directly usable
// while it's still up:
//
//  - No `targetRef` (a tip that isn't about one specific button, like
//    "drag to look around"): a plain banner. `raised` puts it at the
//    kiosk's own raised center (KIOSK_CARD_CENTER — where its dialogs'
//    two rows of quadrants meet) instead of near the bottom.
//  - With a `targetRef`: a small callout next to the target — above it
//    when there's room, below otherwise (e.g. the desktop menu button,
//    which sits right at the top of the screen) — connected by a thin,
//    angled arrow. Normally the callout shifts sideways only as far as
//    the screen edge forces it, so the arrow aims at whichever of the
//    target's edges (left, right, or straight on) ends up closest to it,
//    rather than always its exact center; `align="left"` skips all that
//    and just pins it to the screen's left edge instead (for a target
//    with something else, not just screen edge, immediately to its
//    right — see LEFT_STICK_PADDING).
//
// `closing` plays a fade-out (the caller keeps rendering it for the
// transition's duration before actually removing it — see MainPage.jsx's
// fadeOutHint). Without it, a hint that stops matching just disappears
// instantly — used deliberately for a hint whose target got covered by
// some other UI (e.g. the hamburger's own menu opening over it).
export default function Coachmark({ targetRef, text, onDismiss, raised = false, closing = false, align = "center" }) {
  const [rect, setRect] = useState(null);
  // Stripped of React's colons: some SVG/CSS url(#…) parsers are fussy
  // about them in a fragment id, and several Coachmarks can be on screen
  // at once (the desktop shows its hints simultaneously), so each needs
  // its own marker id.
  const arrowId = "coachmark-arrow-" + useId().replaceAll(":", "");

  useEffect(() => {
    if (!targetRef) return;
    const measure = () => setRect(targetRef.current?.getBoundingClientRect() ?? null);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [targetRef]);

  if (targetRef && !rect) return null; // target not mounted yet

  const closingClass = closing ? " coachmark-closing" : "";

  if (!rect) {
    return (
      <div
        className={"coachmark-banner" + (raised ? " coachmark-banner-raised" : "") + closingClass}
        style={raised ? { top: `${KIOSK_CARD_CENTER * 100}%` } : undefined}
      >
        <span>{text}</span>
        <button type="button" className="coachmark-got-it" onClick={onDismiss}>
          Got it
        </button>
      </div>
    );
  }

  const centerX = rect.left + rect.width / 2;
  const clampedCenterX = Math.min(Math.max(centerX, LEFT_EDGE_MARGIN), window.innerWidth - BOX_HALF_WIDTH);
  const stickLeft = align === "left";
  // The callout's own horizontal anchor: its rendered center normally
  // (clamped to stay on screen), or a fixed point near its pinned left
  // edge for align="left".
  const boxX = stickLeft ? LEFT_STICK_PADDING : clampedCenterX;
  const arrowBoxX = stickLeft ? LEFT_STICK_ARROW_X : clampedCenterX;
  // Not enough room above the target (e.g. the desktop menu button sits
  // right at the top of the screen) — put the callout below it instead.
  const below = rect.top < BOX_HEIGHT_GUESS + GAP;
  const belowGap = stickLeft ? LEFT_STICK_GAP : GAP;
  const boxEdgeY = below ? rect.bottom + belowGap : rect.top - GAP;

  // The arrow aims at the target's left/right edge when the callout had to
  // shift off-center rather than sit centered over it, or straight at the
  // edge facing it (top when above, bottom when below) when it's still
  // centered. align="left" always aims at the bottom-center instead —
  // it's pinned below its target regardless of how far sideways it sits,
  // so "facing edge" is always the bottom, not whichever side it drifted
  // toward.
  let targetX;
  let targetY;
  if (stickLeft) {
    targetX = rect.left + rect.width / 2;
    targetY = rect.bottom;
  } else if (arrowBoxX < rect.left) {
    targetX = rect.left;
    targetY = rect.top + rect.height / 2;
  } else if (arrowBoxX > rect.left + rect.width) {
    targetX = rect.left + rect.width;
    targetY = rect.top + rect.height / 2;
  } else {
    targetX = centerX;
    targetY = below ? rect.bottom : rect.top;
  }

  // The arrow itself stops ARROW_PADDING short of both the callout and the
  // target, rather than touching either — inset along the line's own
  // direction so it stays aimed correctly regardless of the angle.
  const dx = targetX - arrowBoxX;
  const dy = targetY - boxEdgeY;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const lineX1 = arrowBoxX + ux * ARROW_PADDING;
  const lineY1 = boxEdgeY + uy * ARROW_PADDING;
  const lineX2 = targetX - ux * ARROW_PADDING;
  const lineY2 = targetY - uy * ARROW_PADDING;

  return (
    <>
      <div
        className={
          "coachmark-pointer" +
          (below ? " coachmark-pointer-below" : "") +
          (stickLeft ? " coachmark-pointer-left" : "") +
          closingClass
        }
        style={{ left: boxX, top: boxEdgeY }}
      >
        <span>{text}</span>
        <button type="button" className="coachmark-got-it" onClick={onDismiss}>
          Got it
        </button>
      </div>
      {/* A separate full-viewport overlay, not nested in the callout above
          (which is clamped to stay on screen) — draws one angled line from
          the callout's own edge to the target's nearest edge, in real
          screen coordinates, so it stays accurate regardless of how far
          the callout had to shift. */}
      <svg
        className={"coachmark-pointer-arrow" + closingClass}
        viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <marker
            id={arrowId}
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
          </marker>
        </defs>
        <line
          x1={lineX1}
          y1={lineY1}
          x2={lineX2}
          y2={lineY2}
          stroke="var(--accent)"
          strokeWidth="1.5"
          markerEnd={`url(#${arrowId})`}
        />
      </svg>
    </>
  );
}
