import { useEffect, useRef } from "react";
import directionsIcon from "../assets/icons/directions.svg";
import IconPlaceholder from "./IconPlaceholder";

// The white variant of each icon actually used by the sidebar buttons below
// it (search-magnifier, building, question-help are grey by default there —
// see PLACEHOLDER in MainPage.jsx — since those sit on light/transparent
// surfaces; directionsIcon is already a white asset). This overlay reuses
// the exact same icon per function, just switched to the readable-on-dark
// variant for its own opaque backdrop. Nearest Exit itself renders as
// .floating-nearest-exit-btn over the panorama, not inside .app-sidebar —
// listed here anyway (first, same safety-first ordering as the kiosk's own
// radialItems) since it's one of the app's core functions this walkthrough
// covers, same "emergency-exit" icon as that button.
const TIPS = [
  { icon: <IconPlaceholder name="emergency-exit" variant="white" className="inline-icon-img" />, text: "Nearest Exit shows the fastest way outside from wherever you are." },
  { icon: <IconPlaceholder name="search-magnifier" variant="white" className="inline-icon-img" />, text: "Search for a room, building, or place by name." },
  { icon: <img src={directionsIcon} alt="" className="inline-icon-img" />, text: "Get directions to any room." },
  { icon: <IconPlaceholder name="building" variant="white" className="inline-icon-img" />, text: "Browse the directory below to jump to any building or room." },
  { icon: <IconPlaceholder name="question-help" variant="white" className="inline-icon-img" />, text: "Come back here anytime to replay these tips." },
];

// The desktop app sidebar's own session-start walkthrough — a companion to
// DesktopIntroOverlay (the panorama's mouse/keyboard controls), covering
// the sidebar's own functions instead: search, directions, the directory,
// and help. Scoped to .app-sidebar (position: relative — see index.css)
// rather than the full viewport, same reasoning as the panorama overlay:
// it should only cover the region it's actually explaining. Deliberately
// near-opaque (not translucent like the panorama overlay) since the
// sidebar's own content behind it is dense text (the directory), which
// needs to be fully obscured for this overlay's own text to stay readable
// — see .sidebar-intro-overlay in index.css.
//
// No own "click anywhere to begin" line — the two overlays share a single
// exit now (see MainPage.jsx's dismissIntro), and DesktopIntroOverlay's own
// dismiss line already covers both, so repeating it here would be redundant
// on every load. onDismiss is that shared handler, closing both at once
// regardless of which overlay was actually clicked.
export default function SidebarIntroOverlay({ open, onDismiss }) {
  const ref = useRef(null);

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="sidebar-intro-overlay"
      role="button"
      aria-label="What this sidebar can do. Click anywhere to begin."
      onClick={onDismiss}
      onKeyDown={(e) => e.key === "Escape" && onDismiss()}
      tabIndex={-1}
    >
      <ul className="sidebar-intro-tips">
        {TIPS.map((tip) => (
          <li key={tip.text}>
            <span className="sidebar-intro-icon">{tip.icon}</span>
            <span>{tip.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
