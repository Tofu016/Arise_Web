import { floorLabel } from "../utils/constants";
import IconPlaceholder from "./IconPlaceholder";

// Shown over the panorama while a Nearest Exit route's next step is down the
// hidden fire stairs: the stairwell door is behind a marker in the photo, not
// an arrow, so the visitor is told plainly that it is there and which sign to
// look for. The spoken line (utils/emergencyExits.js) says the same.
// `compact` is the kiosk, whose panorama band has no title pill over it.
export default function EmergencyStairsBanner({ step, compact }) {
  if (!step) return null;
  return (
    <div className={"emergency-stairs-banner" + (compact ? " emergency-stairs-banner-kiosk" : "")} role="alert">
      <IconPlaceholder name="stairs" variant="white" className="emergency-stairs-banner-icon" />
      <div className="emergency-stairs-banner-text">
        <strong>Emergency Exit stairs ahead</strong>
        <span>
          Take them {step.goesDown ? "down" : "up"} to {floorLabel(step.floor)}. Look for the glowing Emergency Exit sign.
        </span>
      </div>
    </div>
  );
}
