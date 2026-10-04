import { EMERGENCY_CONTACTS } from "../utils/constants";

// The safety text around a Nearest Exit route, shown in the Directions
// panel for as long as that route (or the lack of one) is on screen.
//
//   hasRoute  false when no way out was found: the contacts then lead,
//             because calling for help is all that is left to do.
//
// `emergency` is directions.emergency (see utils/directionsRoute.js).
export default function EmergencyNotice({ emergency, hasRoute }) {
  return (
    <div className="emergency-notice" role="alert">
      <p className="emergency-notice-lead">Use the stairs. Do not use elevators.</p>
      {hasRoute && emergency.ascends && (
        <p className="emergency-notice-warning">
          <strong>This route goes up.</strong> No way that stays level or goes down was found from here.
          Follow it only if you cannot get out another way, and call for help.
        </p>
      )}
      <p className="emergency-notice-contacts-title">{hasRoute ? "Emergency contacts" : "Call for help now"}</p>
      <ul className="emergency-contacts">
        {EMERGENCY_CONTACTS.map((c) => (
          <li key={c.label}>
            <span>{c.label}</span> <strong>{c.number}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
