import { useEffect, useRef } from "react";
import sdcaLogoReversedWhite from "../assets/images/sdca-logo-reversed-white.png";
import menuIconWhite from "../assets/icons/menu-white.svg";
import HotspotGlyph from "./HotspotGlyph";
import { KIOSK_INTRO_TEXT } from "../utils/introScript";
import { useIntroReady } from "../hooks/useIntroReady";

// Hand-drawn (nothing touch-specific exists in the icon set): a fingertip dot
// sliding between two arrowheads to read as "drag", and the real hotspot's
// look (HotspotGlyph) for "tap".
export function DragIcon() {
  return (
    <svg className="kiosk-intro-icon-svg" viewBox="0 0 60 60" aria-hidden="true">
      <path d="M12 30 L4 30 M4 30 L9 25 M4 30 L9 35" stroke="var(--white)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M48 30 L56 30 M56 30 L51 25 M56 30 L51 35" stroke="var(--white)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle className="kiosk-intro-drag-dot" cx="30" cy="30" r="9" fill="var(--white)" />
    </svg>
  );
}

export function TapIcon() {
  return (
    <svg className="kiosk-intro-icon-svg" viewBox="0 0 60 60" aria-hidden="true">
      <HotspotGlyph cx={30} cy={30} />
    </svg>
  );
}

// Full-screen, session-start walkthrough for the kiosk, the touch counterpart
// of DesktopIntroOverlay: one upfront splash dismissed by a tap anywhere,
// replacing the old sequential "Got it" coachmarks and the help dialog. The
// parent positions it over the panorama band only (see style prop), so the
// header and the signage band stay visible. Not persisted, for the same
// reason as the desktop overlay: every kiosk session starts with a fresh
// MainPageContent mount, and each new visitor should see it.
export default function KioskIntroOverlay({ open, onDismiss, style }) {
  const ref = useRef(null);
  const ready = useIntroReady(open);

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      className="kiosk-intro-overlay"
      style={style}
      role="button"
      aria-label="How to use this tour. Tap anywhere to begin."
      onClick={ready ? onDismiss : undefined}
      onKeyDown={(e) => ready && e.key === "Escape" && onDismiss()}
      tabIndex={-1}
    >
      <img src={sdcaLogoReversedWhite} alt="St. Dominic College of Asia" className="desktop-intro-logo" />

      <div className="kiosk-intro-tips">
        <div className="kiosk-intro-tip">
          <div className="kiosk-intro-icon"><DragIcon /></div>
          <p>{KIOSK_INTRO_TEXT.drag}</p>
        </div>
        <div className="kiosk-intro-tip">
          <div className="kiosk-intro-icon"><TapIcon /></div>
          <p>{KIOSK_INTRO_TEXT.hotspot}</p>
        </div>
        <div className="kiosk-intro-tip">
          <div className="kiosk-intro-icon">
            <span className="kiosk-intro-menu-badge">
              <img src={menuIconWhite} alt="" className="inline-icon-img" />
            </span>
          </div>
          <p>{KIOSK_INTRO_TEXT.menu}</p>
        </div>
      </div>

      <p className={"desktop-intro-dismiss kiosk-intro-dismiss" + (ready ? " intro-dismiss-ready" : "")}>Tap anywhere to begin</p>
    </div>
  );
}
