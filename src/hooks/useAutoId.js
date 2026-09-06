import { useEffect, useState } from "react";

// Shared "auto-generate the id from other fields until the admin types
// their own" state machine used by NodeForm.jsx (keyed off Building/
// Floor/Type) and TourStopForm.jsx (keyed off Name). Only ever active in
// create mode — an existing entity is never auto-renamed this way (see
// each form's own opt-in "Suggested ID" prompt instead, since a silent
// rename would cascade through every other entity's neighbor list).
//
// `resetDep` is whatever identifies "a different entity is now being
// edited" (NodeForm passes `node`, TourStopForm passes `stop`) — changing
// it re-syncs idAutoManaged to match the (possibly new) mode.
export function useAutoId(mode, resetDep) {
  const [idAutoManaged, setIdAutoManaged] = useState(mode !== "edit");

  useEffect(() => {
    setIdAutoManaged(mode !== "edit");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, resetDep]);

  // A real value typed directly into the id field takes manual control —
  // stop auto-generating it going forward. Clearing the field back to
  // empty is treated as the OPPOSITE of manual control — it re-enables
  // auto-suggestion, since an empty field isn't a deliberate value to
  // preserve, and the next triggering change should repopulate it rather
  // than leaving it permanently blank.
  const noteIdFieldChanged = (value) => setIdAutoManaged(value.trim() === "");

  return { idAutoManaged, noteIdFieldChanged };
}
