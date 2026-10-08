import { useEffect, useRef } from "react";
import IconPlaceholder from "./IconPlaceholder";
import infoIcon from "../assets/icons/info-i-white.svg";
import { SIDEBAR_INTRO_TEXT } from "../utils/introScript";

// The white variant of each icon actually used by the sidebar buttons below
// it (search-magnifier, directions, question-help are grey by default there,
// see PLACEHOLDER in MainPage.jsx, since those sit on light/transparent
// surfaces). "directory" is a dedicated icon (a location pin with list
// lines, i.e. a list of places, not a file-folder glyph), not reused from
// elsewhere: nothing else in the app already represents "browse the
// directory" specifically. Building and Nearest Exit live in the menu FAB's
// buttons, which spill over the panorama, not inside .app-sidebar, but are
// listed here anyway since they're core functions this walkthrough covers,
// with the same icons as those buttons. Order follows SIDEBAR_INTRO_TEXT.
const TIPS = [
  { icon: <IconPlaceholder name="directory" variant="white" className="inline-icon-img" />, text: SIDEBAR_INTRO_TEXT.directory },
  { icon: <IconPlaceholder name="search-magnifier" variant="white" className="inline-icon-img" />, text: SIDEBAR_INTRO_TEXT.search },
  { icon: <IconPlaceholder name="directions" variant="white" className="inline-icon-img" />, text: SIDEBAR_INTRO_TEXT.directions },
  { icon: <IconPlaceholder name="building" variant="white" className="inline-icon-img" />, text: SIDEBAR_INTRO_TEXT.building },
  { icon: <IconPlaceholder name="emergency-exit" variant="white" className="inline-icon-img" />, text: SIDEBAR_INTRO_TEXT.exit },
  // The tips button itself, as it looks: a white "i" on the brand maroon.
  {
    icon: (
      <span className="intro-info-badge">
        <img src={infoIcon} alt="" />
      </span>
    ),
    text: SIDEBAR_INTRO_TEXT.help,
  },
];

// The desktop app sidebar's own session-start walkthrough — a companion to
// DesktopIntroOverlay (the panorama's mouse/keyboard controls), covering
// the sidebar's own functions instead: the directory, search, directions,
// the building selector, Nearest Exit and help. Scoped to .app-sidebar (position: relative — see index.css)
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
