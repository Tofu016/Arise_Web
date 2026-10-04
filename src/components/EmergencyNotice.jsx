import { EMERGENCY_CONTACTS } from "../utils/constants";

// The safety text around a Nearest Exit route, shown in the Directions
// panel for as long as that route (or the lack of one) is on screen.
//
//   hasRoute      false when no way out was found: the contacts then lead,
//                 because calling for help is all that is left to do.
//   showContacts  false on desktop, where the sidebar's red bottom band
//                 (EmergencyContactsBand) carries the contacts instead.
//
// `emergency` is directions.emergency (see utils/directionsRoute.js).
export default function EmergencyNotice({ emergency, hasRoute, showContacts = true }) {
  return (
    <div className="emergency-notice" role="alert">
      <p className="emergency-notice-lead">Use the stairs. Do not use elevators.</p>
      {hasRoute && emergency.ascends && (
        <p className="emergency-notice-warning">
          <strong>This route goes up.</strong> No way that stays level or goes down was found from here.
          Follow it only if you cannot get out another way, and call for help.
        </p>
      )}
      {showContacts && (
        <>
          <p className="emergency-notice-contacts-title">{hasRoute ? "Emergency contacts" : "Call for help now"}</p>
          <ul className="emergency-contacts">
            {EMERGENCY_CONTACTS.map((c) => (
              <li key={c.label}>
                <span>{c.label}</span> <strong>{c.number}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// The desktop sidebar's red bottom band: it replaces the sidebar's own
// background for its lower ~30% while Nearest Exit is open.
export function EmergencyContactsBand() {
  return (
    <section className="emergency-band" aria-label="Emergency contacts">
      <h3 className="emergency-band-title">
        <span>In case of</span>
        <strong>Emergency...</strong>
      </h3>
      <ul className="emergency-band-list">
        {EMERGENCY_CONTACTS.map((c) => (
          <li key={c.label}>
            <span>{c.label}</span>
            <strong>{c.number}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
