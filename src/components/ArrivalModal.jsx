import { useEffect, useRef } from "react";
import { KIOSK_RAISED_STYLE } from "../utils/kioskLayout";

export const ARRIVAL_NOTICE_MS = 5000;

// A small notice shown when a route ends, in place of the directions dialog.
// Same spot as a centered modal, but with no scrim and no button: it lets
// touches through to the panorama and calls onDone (closing directions) by
// itself after ARRIVAL_NOTICE_MS.
export default function ArrivalModal({ kiosk, onDone }) {
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });
  useEffect(() => {
    const id = setTimeout(() => onDoneRef.current(), ARRIVAL_NOTICE_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      className={"modal-overlay arrival-notice-overlay" + (kiosk ? " kiosk-raised-overlay" : "")}
      style={kiosk ? KIOSK_RAISED_STYLE : undefined}
    >
      <div className="modal arrival-notice" role="status">
        <p className="idle-prompt-text">You have reached your destination.</p>
      </div>
    </div>
  );
}
