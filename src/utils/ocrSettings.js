// The OCR Management page's per-room settings, as the page edits them before
// saving: { ocrEnabled, placardName, extraTerms, photoPaths }. photoPaths are
// the room's own 360 images for the mobile AR portal after a scan, in the
// order the visitor pages through them (none shows the placeholder); they are
// separate from the room's photos, which the room card's 360 VIEW keeps
// showing. Search terms generated
// from the Placard name are not part of it: they are recomputed on save
// (entities.js ocrSaveBody), so they can't drift from the name.
import { findTermCollisions, generateOcrTerms, generatedTermsStale, normalizeExtraTerm } from "./ocrTerms";

// What is saved for a room now (a searchable room, see search.js). A room
// with no details record yet is simply off.
export function ocrStateOf(room) {
  const p = room.placard;
  return {
    ocrEnabled: !!p?.ocrEnabled,
    placardName: p?.placardName || "",
    extraTerms: p?.ocrExtraTerms || [],
    photoPaths: p?.ocrPhotos || [],
  };
}

function sameList(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export function sameOcrState(a, b) {
  return (
    a.ocrEnabled === b.ocrEnabled &&
    a.placardName === b.placardName &&
    sameList(a.extraTerms, b.extraTerms) &&
    sameList(a.photoPaths, b.photoPaths)
  );
}

// Adding a room keeps the Placard name it had (from an earlier time on
// OCR) and otherwise starts from its room name.
export function addToOcr(state, roomName) {
  return { ...state, ocrEnabled: true, placardName: state.placardName.trim() || roomName };
}

// Taking a room off keeps its Placard name, extra terms and AR 360 images, so
// adding it back restores them.
export function removeFromOcr(state) {
  return { ...state, ocrEnabled: false };
}

// Adds a typed extra term in its stored form. Returns { state, refused }:
// refused says why nothing was added ("empty" or "duplicate", the latter
// also when the Placard name already generates it).
export function addExtraTerm(state, raw) {
  const term = normalizeExtraTerm(raw);
  if (!term) return { state, refused: "empty" };
  if (state.extraTerms.includes(term) || generateOcrTerms(state.placardName).includes(term)) {
    return { state, refused: "duplicate" };
  }
  return { state: { ...state, extraTerms: [...state.extraTerms, term] }, refused: null };
}

export function removeExtraTerm(state, term) {
  return { ...state, extraTerms: state.extraTerms.filter((t) => t !== term) };
}

// Why an eligible room can't be saved as it is, or null.
export function ocrStateProblem(state) {
  if (!state.ocrEnabled) return null;
  if (!state.placardName.trim()) return "Enter the name printed on the placard.";
  if (generateOcrTerms(state.placardName).length === 0) return "The Placard name needs at least one letter or number.";
  return null;
}

// The room as the scanner would see it once `state` is saved: what the
// page's "Test a read" box and collision check run against.
export function withOcrState(room, state) {
  return {
    ...room,
    placard: {
      ...room.placard,
      ocrEnabled: state.ocrEnabled,
      placardName: state.placardName,
      ocrPhotos: state.photoPaths,
      ocrSearchTerms: [...generateOcrTerms(state.placardName), ...state.extraTerms],
    },
  };
}

// Is a saved, eligible room's stored set of generated terms out of step with
// its Placard name (stored by the old Room Editor rule, say)? Saving it
// again fixes it.
export function hasStaleTerms(room) {
  const p = room.placard;
  return !!p?.ocrEnabled && generatedTermsStale(p.ocrGeneratedTerms, p.placardName || room.roomName);
}

// Shared search terms among `rooms` (eligible, with their states applied,
// see withOcrState), keyed by `keyOf(room)`.
export function ocrCollisions(rooms, keyOf) {
  return findTermCollisions(rooms.map((r) => ({ key: keyOf(r), roomName: r.roomName, terms: r.placard.ocrSearchTerms })));
}

// Has the room its own AR 360 images, which View in AR shows after a scan
// (instead of the placeholder)?
export function hasOcrPhoto(state) {
  return state.photoPaths.length > 0;
}
