import { useEffect, useRef } from "react";
import sdcaLogoReversedWhite from "../assets/images/sdca-logo-reversed-white.png";
import menuIconWhite from "../assets/icons/menu-white.svg";
import IconPlaceholder from "./IconPlaceholder";
import { DragIcon, TapIcon } from "./KioskIntroOverlay";
import { MOBILE_INTRO_TEXT } from "../utils/introScript";
import { useIntroReady } from "../hooks/useIntroReady";

// Hand-drawn like the kiosk's drag and tap icons (nothing touch-specific
// exists in the icon set): two fingertips moving apart along a diagonal.
function PinchIcon() {
  return (
    <svg className="kiosk-intro-icon-svg" viewBox="0 0 60 60" aria-hidden="true">
      <path d="M14 46 L8 52 M8 52 L8 45 M8 52 L15 52" stroke="var(--white)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M46 14 L52 8 M52 8 L45 8 M52 8 L52 15" stroke="var(--white)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle className="mobile-intro-pinch-a" cx="24" cy="36" r="7" fill="var(--white)" />
      <circle className="mobile-intro-pinch-b" cx="36" cy="24" r="7" fill="var(--white)" />
    </svg>
  );
}

// Order follows MOBILE_INTRO_TEXT, which is also the narration order.
const TIPS = [
  { key: "drag", icon: <DragIcon /> },
  { key: "hotspot", icon: <TapIcon /> },
  { key: "zoom", icon: <PinchIcon /> },
  { key: "preview", icon: <IconPlaceholder name="landscape-photo" variant="white" className="mobile-intro-glyph" /> },
  {
    key: "menu",
    icon: (
      <span className="mobile-intro-menu-badge">
        <img src={menuIconWhite} alt="" className="inline-icon-img" />
      </span>
    ),
  },
  { key: "help", icon: <IconPlaceholder name="question-help" variant="white" className="mobile-intro-glyph" /> },
];

// The Mobile web layout's session-start walkthrough: the touch counterpart of
// DesktopIntroOverlay and SidebarIntroOverlay in one, since on a phone the
// sidebar starts closed and has no region of its own to explain in place.
// Covers the whole screen, dismissed by a tap anywhere once ready (see
// useIntroReady). Not persisted, same as the other intros.
export default function MobileIntroOverlay({ open, onDismiss }) {
  const ref = useRef(null);
  const ready = useIntroReady(open);

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="mobile-intro-overlay"
      role="button"
      aria-label="How to use this tour. Tap anywhere to begin."
      onClick={ready ? onDismiss : undefined}
      onKeyDown={(e) => ready && e.key === "Escape" && onDismiss()}
      tabIndex={-1}
    >
      <img src={sdcaLogoReversedWhite} alt="St. Dominic College of Asia" className="mobile-intro-logo" />
      <ul className="mobile-intro-tips">
        {TIPS.map((tip) => (
          <li key={tip.key}>
            <span className="mobile-intro-icon">{tip.icon}</span>
            <span>{MOBILE_INTRO_TEXT[tip.key]}</span>
          </li>
        ))}
      </ul>
      <p className={"desktop-intro-dismiss mobile-intro-dismiss" + (ready ? " intro-dismiss-ready" : "")}>Tap anywhere to begin</p>
    </div>
  );
}
