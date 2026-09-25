import { KIOSK_RAISED_STYLE } from "../utils/kioskLayout";
import directionsIcon from "../assets/icons/directions.svg";
import IconPlaceholder from "./IconPlaceholder";

const DIRECTIONS_ICON = <img src={directionsIcon} alt="" className="inline-icon-img" />;
// Pending real icons — see the icon list handed back to the user.
const PLACEHOLDER = (name) => <IconPlaceholder name={name} className="inline-icon-img" />;

// The same quick tips the first-run coachmarks cover, kept reachable at
// any time afterward — from the desktop menu panel, or the kiosk's radial
// dock — plus a way to bring the coachmark sequence back mid-session if it
// was dismissed by mistake (a fresh page load or kiosk reset already
// starts the sequence over on its own — see useOnboardingHints.js).
const TIPS = {
  desktop: [
    { icon: PLACEHOLDER("mouse-drag"), text: "Drag to look around, or use WASD or the arrow keys." },
    { icon: "➜", text: "Click a glowing arrow in the photo to walk that way." },
    { icon: "☰", text: "Open the menu for buildings, entrances and more." },
    { icon: DIRECTIONS_ICON, text: "Get directions to any room." },
  ],
  kiosk: [
    { icon: PLACEHOLDER("touch-tap"), text: "Touch and drag to look around." },
    { icon: "➜", text: "Tap a glowing arrow in the photo to walk that way." },
    { icon: "☰", text: "Tap the menu button for search, directions and more." },
  ],
};

export default function HelpModal({ open, kiosk, onClose, onReplay }) {
  if (!open) return null;

  return (
    <div
      className={"modal-overlay" + (kiosk ? " kiosk-raised-overlay" : "")}
      style={kiosk ? KIOSK_RAISED_STYLE : undefined}
      onClick={onClose}
    >
      <div className="modal help-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <h3>How to use this tour</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <ul className="help-tip-list">
          {(kiosk ? TIPS.kiosk : TIPS.desktop).map((tip) => (
            <li key={tip.text}>
              <span className="help-tip-icon">{tip.icon}</span>
              <span>{tip.text}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="help-replay-btn"
          onClick={() => {
            onReplay();
            onClose();
          }}
        >
          Replay the intro tips
        </button>
      </div>
    </div>
  );
}
