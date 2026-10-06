// The mobile placard scanner's text rules: how a placard's text and a room's
// OCR search terms are normalized, and the search terms generated from a
// room's Placard name. Ported to the mobile app's src/utils/ocrTerms.js (keep
// in step): the OCR Management page generates and stores the terms, and the
// scanner normalizes what it reads the same way before comparing.
//
// One text, three forms:
//   spaced   "computer lab 2", "gd1-101", "dean's office"
//   compact  the spaced form without spaces: "computerlab2", "dean'soffice"
//   bare     the compact form without dashes or apostrophes: "deansoffice"
// All three are lowercase, with accented letters folded to plain ones
// ("Café" is "cafe") and every symbol other than a dash or an apostrophe
// dropped. Dashes and apostrophes are kept because they tell placards apart
// ("GD1-101" is not "GD11-01"); every dash and apostrophe character OCR may
// return (en dash, curly quote, prime, ...) counts as the plain ASCII one.
//
// A Placard name's generated search terms are its compact form, its bare
// form (so a read where OCR dropped the dash still matches exactly, and
// app builds from before OCR Management, which compare bare text, still
// match), and, for a name of several words, its spaced form (what fuzzy
// matching compares best against a read with its spaces intact). Deliberate
// guesses at misreads (0 for O, 1 for l) are not generated: fuzzy matching
// offers those as suggestions, and an admin can add one as an extra term.

const DASHES = /[‐-―−⸺⸻﹘﹣－]/g;
const APOSTROPHES = /[‘’‚‛′‵ʼ`´＇]/g;

// Letters that Unicode does not split into a plain letter plus an accent.
const UNSPLIT_LETTERS = { ß: "ss", æ: "ae", ø: "o", œ: "oe", đ: "d", ð: "d", ł: "l", ı: "i", þ: "th" };
const UNSPLIT = new RegExp(`[${Object.keys(UNSPLIT_LETTERS).join("")}]`, "g");

export function spacedOcrForm(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(UNSPLIT, (c) => UNSPLIT_LETTERS[c])
    .replace(DASHES, "-")
    .replace(APOSTROPHES, "'")
    .replace(/[^\p{L}\p{N}'-]+/gu, " ")
    .replace(/\s*-[\s-]*/g, "-")
    .replace(/\s*'[\s']*/g, "'")
    .replace(/^[\s'-]+|[\s'-]+$/g, "");
}

export function compactOcrForm(text) {
  return spacedOcrForm(text).replace(/ /g, "");
}

export function bareOcrForm(text) {
  return compactOcrForm(text).replace(/['-]/g, "");
}

// Every search term generated from a Placard name, compact form first.
export function generateOcrTerms(placardName) {
  const spaced = spacedOcrForm(placardName);
  if (!spaced) return [];
  const terms = [compactOcrForm(spaced), bareOcrForm(spaced)];
  if (spaced.includes(" ")) terms.push(spaced);
  return [...new Set(terms.filter(Boolean))];
}

// An extra term an admin types is stored in its compact form.
export function normalizeExtraTerm(term) {
  return compactOcrForm(term);
}

// The name the scanner looks for on a room's placard: its Placard name, or
// its room name when it has none.
export function effectivePlacardName(placard, roomName) {
  return (placard?.placardName || "").trim() || roomName;
}

// Does the scanner match this room (a searchable room, see search.js)?
export function isOcrEligible(room) {
  return !!room.placard?.ocrEnabled;
}

// Every search term the scanner compares a read against for this room: the
// ones stored, plus the ones its Placard name generates now, so a room whose
// stored terms predate the current format still matches in both.
export function ocrTermsForRoom(room) {
  const name = effectivePlacardName(room.placard, room.roomName);
  return [...new Set([...(room.placard?.ocrSearchTerms || []), ...generateOcrTerms(name)])];
}

// Have a room's stored generated terms fallen out of step with its Placard
// name (stored by an older version of these rules, say)?
export function generatedTermsStale(storedGenerated, placardName) {
  const fresh = generateOcrTerms(placardName);
  const stored = new Set(storedGenerated || []);
  return stored.size !== fresh.length || fresh.some((t) => !stored.has(t));
}

// Search terms shared by more than one room. A read matching a shared term
// exactly is offered as a choice between the rooms instead of opening one.
// `rooms` is [{ key, roomName, terms }]; returns a Map from each key with a
// shared term to [{ term, roomNames }], one entry per shared compact term,
// naming the other rooms.
export function findTermCollisions(rooms) {
  const byTerm = new Map();
  for (const room of rooms) {
    for (const term of new Set(room.terms.map(compactOcrForm).filter(Boolean))) {
      const owners = byTerm.get(term) ?? [];
      owners.push(room);
      byTerm.set(term, owners);
    }
  }
  const out = new Map();
  for (const [term, owners] of byTerm) {
    if (owners.length < 2) continue;
    for (const room of owners) {
      const list = out.get(room.key) ?? [];
      list.push({ term, roomNames: owners.filter((o) => o !== room).map((o) => o.roomName) });
      out.set(room.key, list);
    }
  }
  return out;
}
