import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// The desktop tour's interactive tutorial: learn by doing. Each step
// spotlights a real control and waits for the visitor to actually use it —
// drag to look, walk through a hotspot, zoom, search, browse the
// Directory, open directions, open the menu — then ticks and moves on.
// The page stays fully usable throughout (the dimming lets every click
// through); Skip step and Skip tutorial are always there, and Escape skips.
// Replaces the desktop's two tip overlays (DesktopIntroOverlay and
// SidebarIntroOverlay); the Mobile web layout and the kiosk keep theirs.
//
//   <DesktopTutorial signals={{ nodeId, searchQuery, panelMode, menuOpen }}
//     onPrepare={(stepKey) => …} onFinish={() => …} />
//
// signals: what MainPage knows, read to tell a step was done (the drag,
//          wheel and key steps listen on the page themselves).
// onPrepare(stepKey): called as a step begins, so MainPage can put the
//          page in the state that step needs (e.g. clear the search so the
//          Directory shows again).
// onFinish: Finish, Skip tutorial or Escape.

const PANORAMA = ".main-page-screen";

const STEPS = [
  {
    key: "look",
    target: PANORAMA,
    title: "Look around",
    text: "Click and drag the view to look around.",
    hint: "Or use A and D, or the arrow keys.",
  },
  {
    key: "walk",
    target: PANORAMA,
    title: "Move to another spot",
    text: "Click a glowing hotspot to walk there.",
    hint: "Or press W to walk forward. Can't see one? Look around first.",
  },
  {
    key: "zoom",
    target: PANORAMA,
    title: "Zoom in and out",
    text: "Scroll the mouse wheel over the view.",
    hint: "Or hold Shift to zoom in, Ctrl to zoom out.",
  },
  {
    key: "search",
    target: ".app-sidebar-search .floating-search-bar",
    title: "Search",
    text: "Type the name of a room or place to find it.",
    hint: "Try a room you know, like a laboratory.",
  },
  {
    key: "directory",
    target: ".app-sidebar-content",
    title: "Browse the Directory",
    text: "Open a building, or pick a room from the list.",
    hint: "Each building lists its rooms by floor. \"You are here\" marks where you are.",
  },
  {
    key: "directions",
    target: ".floating-search-directions",
    title: "Get directions",
    text: "Click this button for step-by-step directions to any room.",
  },
  {
    key: "menu",
    // The menu's buttons open beside the sidebar, outside the button itself,
    // so the spotlight covers both once it's open.
    target: [".desktop-menu-fab", ".desktop-menu-stack"],
    title: "The menu",
    text: "Open it to choose a building, find the Nearest Exit, or give feedback.",
    // Opening it shows the buttons; the visitor reads them, then goes on.
    holdWhenDone: true,
    doneText: "From the top: Choose a building, Nearest Exit, and Give feedback. Click Next when you're ready.",
  },
  {
    key: "replay",
    target: ".floating-help-btn",
    title: "You're all set!",
    text: "Press the i button anytime to go through this tutorial again.",
    final: true,
  },
];

// How far a drag must travel (px) to count as looking around.
const DRAG_PX = 60;
// The tick on a done step, before moving on.
const DONE_MS = 900;
const GAP = 16; // between the spotlight and the card, and from screen edges
const SPOT_PAD = 6; // the spotlight's margin around its target

export default function DesktopTutorial({ signals, onPrepare, onFinish }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const [cardSize, setCardSize] = useState({ w: 340, h: 180 });
  const cardRef = useRef(null);
  const step = STEPS[index];

  // The signals as the current step began (to tell a change, e.g. a new
  // spot), taken when the step changes.
  const [start, setStart] = useState({ index, signals });
  if (start.index !== index) setStart({ index, signals });

  // Done by doing: either something MainPage reports (signals) or a page
  // event this component hears itself (eventDoneAt, the step it was for).
  const [eventDoneAt, setEventDoneAt] = useState(-1);
  const signalDone =
    start.index === index &&
    ((step.key === "walk" && !!signals.nodeId && signals.nodeId !== start.signals.nodeId) ||
      (step.key === "search" && (signals.searchQuery || "").trim().length >= 2) ||
      (step.key === "directions" && signals.panelMode === "directions") ||
      (step.key === "menu" && !!signals.menuOpen));
  // Latched: once done, a step stays done even if the page moves on (e.g.
  // the menu is closed again while its step waits for Next).
  const [signalDoneAt, setSignalDoneAt] = useState(-1);
  if (signalDone && signalDoneAt !== index) setSignalDoneAt(index);
  const done = !step.final && (eventDoneAt === index || signalDoneAt === index || signalDone);

  // Step begins: MainPage puts the page in the state it needs.
  const prepareRef = useRef(onPrepare);
  useEffect(() => {
    prepareRef.current = onPrepare;
  });
  useEffect(() => {
    prepareRef.current?.(STEPS[index].key);
  }, [index]);

  const markDone = useCallback(() => setEventDoneAt(index), [index]);

  // Page-event steps: dragging and wheeling over the panorama, keys, and a
  // click in the Directory.
  useEffect(() => {
    if (done) return undefined;
    let down = null;
    const inPanorama = (e) => !!e.target?.closest?.(PANORAMA);
    const onPointerDown = (e) => {
      if (step.key === "look" && inPanorama(e)) down = { x: e.clientX, y: e.clientY };
    };
    const onPointerMove = (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) >= DRAG_PX) markDone();
    };
    const onPointerUp = () => {
      down = null;
    };
    const onWheel = (e) => {
      if (step.key === "zoom" && inPanorama(e)) markDone();
    };
    const onKeyDown = (e) => {
      if (e.target?.closest?.("input, textarea")) return;
      if (step.key === "look" && ["a", "A", "d", "D", "ArrowLeft", "ArrowRight"].includes(e.key)) markDone();
      if (step.key === "zoom" && (e.key === "Shift" || e.key === "Control")) markDone();
    };
    const onClick = (e) => {
      if (step.key === "directory" && e.target?.closest?.(".directory-accordion")) markDone();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("wheel", onWheel, { capture: true, passive: true });
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("wheel", onWheel, { capture: true });
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("click", onClick, true);
    };
  }, [step.key, done, markDone]);

  const next = useCallback(() => {
    if (index >= STEPS.length - 1) onFinish?.();
    else setIndex((i) => i + 1);
  }, [index, onFinish]);

  // A done step ticks, then moves on by itself (unless it waits for Next).
  useEffect(() => {
    if (!done || step.final || step.holdWhenDone) return undefined;
    const t = setTimeout(next, DONE_MS);
    return () => clearTimeout(t);
  }, [done, step.final, step.holdWhenDone, next]);

  // Escape skips the tutorial.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onFinish?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFinish]);

  // Follow the target: it can move or resize (panels open, the window
  // changes), so it's re-measured a few times a second.
  useEffect(() => {
    const measure = () => {
      const selectors = Array.isArray(step.target) ? step.target : [step.target];
      const rects = selectors
        .map((sel) => document.querySelector(sel)?.getBoundingClientRect())
        .filter((b) => b && b.width > 0 && b.height > 0);
      const r = rects.length
        ? rects.reduce((u, b) => {
            const left = Math.min(u.left, b.left);
            const top = Math.min(u.top, b.top);
            return {
              left,
              top,
              width: Math.max(u.left + u.width, b.left + b.width) - left,
              height: Math.max(u.top + u.height, b.top + b.height) - top,
            };
          })
        : null;
      setRect((prev) => {
        if (!r || r.width === 0) return prev === null ? prev : null;
        const nextRect = { top: r.top, left: r.left, width: r.width, height: r.height };
        const same =
          prev &&
          Math.abs(prev.top - nextRect.top) < 0.5 &&
          Math.abs(prev.left - nextRect.left) < 0.5 &&
          Math.abs(prev.width - nextRect.width) < 0.5 &&
          Math.abs(prev.height - nextRect.height) < 0.5;
        return same ? prev : nextRect;
      });
    };
    const first = requestAnimationFrame(measure);
    const timer = setInterval(measure, 250);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(first);
      clearInterval(timer);
      window.removeEventListener("resize", measure);
    };
  }, [step.target]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const { offsetWidth: w, offsetHeight: h } = el;
    setCardSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
  }, [index, done]);

  // Where the card goes: inside the bottom of a big target (the panorama),
  // otherwise beside the target — right if there's room, else left.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let cardPos = { left: (vw - cardSize.w) / 2, top: vh - cardSize.h - GAP * 2 };
  if (rect) {
    const big = rect.width * rect.height > vw * vh * 0.25;
    const clampTop = (t) => Math.max(GAP, Math.min(t, vh - cardSize.h - GAP));
    if (big) {
      cardPos = {
        left: rect.left + (rect.width - cardSize.w) / 2,
        top: rect.top + rect.height - cardSize.h - GAP * 2,
      };
    } else if (rect.left + rect.width + GAP + cardSize.w + GAP <= vw) {
      cardPos = { left: rect.left + rect.width + GAP + SPOT_PAD, top: clampTop(rect.top) };
    } else {
      cardPos = { left: rect.left - GAP - SPOT_PAD - cardSize.w, top: clampTop(rect.top) };
    }
  }

  const spot = rect && {
    top: rect.top - SPOT_PAD,
    left: rect.left - SPOT_PAD,
    width: rect.width + SPOT_PAD * 2,
    height: rect.height + SPOT_PAD * 2,
  };

  return (
    <div className="desktop-tutorial" role="region" aria-label="Tutorial">
      {spot ? (
        <div className={"desktop-tutorial-spot" + (done ? " desktop-tutorial-spot-done" : "")} style={spot} aria-hidden="true" />
      ) : (
        <div className="desktop-tutorial-dim" aria-hidden="true" />
      )}

      <div
        ref={cardRef}
        className={"desktop-tutorial-card" + (done ? " desktop-tutorial-card-done" : "")}
        style={{ left: cardPos.left, top: cardPos.top }}
        aria-live="polite"
      >
        <div className="desktop-tutorial-progress">
          <span>
            Step {index + 1} of {STEPS.length}
          </span>
          <span className="desktop-tutorial-dots" aria-hidden="true">
            {STEPS.map((s, i) => (
              <span key={s.key} className={"desktop-tutorial-dot" + (i < index || (i === index && done) ? " desktop-tutorial-dot-done" : i === index ? " desktop-tutorial-dot-current" : "")} />
            ))}
          </span>
        </div>
        <h3 className="desktop-tutorial-title">
          {done && !step.final ? (
            <>
              <span className="desktop-tutorial-check" aria-hidden="true">
                ✓
              </span>{" "}
              Nice!
            </>
          ) : (
            step.title
          )}
        </h3>
        <p className="desktop-tutorial-text">{done && step.doneText ? step.doneText : step.text}</p>
        {step.hint && !done && <p className="desktop-tutorial-hint">{step.hint}</p>}
        {!step.final && !done && <p className="desktop-tutorial-try">Try it now</p>}

        <div className="desktop-tutorial-actions">
          {!step.final && (
            <button type="button" className="desktop-tutorial-skip-all" onClick={onFinish}>
              Skip tutorial
            </button>
          )}
          {step.final ? (
            <button type="button" className="desktop-tutorial-primary" onClick={onFinish} autoFocus>
              Finish
            </button>
          ) : done && step.holdWhenDone ? (
            <button type="button" className="desktop-tutorial-primary" onClick={next}>
              Next
            </button>
          ) : (
            <button type="button" className="desktop-tutorial-secondary" onClick={next} disabled={done}>
              Skip step
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
