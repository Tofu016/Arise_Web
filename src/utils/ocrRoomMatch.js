import Fuse from "fuse.js";
import { bareOcrForm, compactOcrForm, effectivePlacardName, ocrTermsForRoom, spacedOcrForm } from "./ocrTerms";

// Matches what the mobile placard scanner read against the rooms it may
// match (the OCR-eligible ones; the caller filters). Ported to the mobile
// app's src/utils/ocrRoomMatch.js (keep in step); here it drives the OCR
// Management page's "Test a read" box, so an admin sees what a phone would.
//
// Returns candidates best-first: { room, score (1 = perfect), matchesTerm,
// isExact }.
//   matchesTerm  the whole read is one of the room's search terms, after
//                normalizing (see ocrTerms.js). Compared in compact form
//                first; only when no room matches that way, in bare form,
//                so a read whose dash OCR dropped still lands.
//   isExact      the scanner opens this room without asking: it is the
//                only room matching a term. A term two rooms share makes
//                both suggestions instead. A high fuzzy score alone never
//                counts: "GD1-10" scores close to both GD1-101 and GD1-102.
// Everything else is a fuzzy match on the Placard name and search terms,
// offered as "Did you mean...".
//
// threshold is Fuse's own match-strictness knob: 0 = exact match only,
// 1 = matches almost anything. 0.4 is a deliberately forgiving middle
// ground, since OCR output is rarely a clean, exact match to begin with.
const FUSE_OPTIONS = {
  keys: ["placardName", "terms"],
  includeScore: true,
  threshold: 0.4,
};

export function matchRoomsFromOcr(ocrText, rooms) {
  const spaced = spacedOcrForm(ocrText);
  if (!spaced || rooms.length === 0) return [];
  const compact = compactOcrForm(spaced);
  const bare = bareOcrForm(spaced);

  const entries = rooms.map((room) => {
    const terms = ocrTermsForRoom(room);
    return {
      room,
      placardName: effectivePlacardName(room.placard, room.roomName),
      terms,
      compactTerms: new Set(terms.map(compactOcrForm)),
      bareTerms: new Set(terms.map(bareOcrForm)),
    };
  });

  const byCompact = entries.filter((e) => e.compactTerms.has(compact));
  const termMatches = new Set(byCompact.length > 0 ? byCompact : entries.filter((e) => bare && e.bareTerms.has(bare)));
  const opens = termMatches.size === 1 ? [...termMatches][0] : null;

  // Best (lowest) Fuse score per room across the read's forms.
  const fuse = new Fuse(entries, FUSE_OPTIONS);
  const best = new Map();
  for (const entry of termMatches) best.set(entry, 0);
  for (const query of new Set([spaced, compact, bare].filter(Boolean))) {
    for (const r of fuse.search(query)) {
      const score = r.score ?? 1;
      const seen = best.get(r.item);
      if (seen === undefined || score < seen) best.set(r.item, score);
    }
  }

  return [...best.entries()]
    .sort((a, b) => Number(termMatches.has(b[0])) - Number(termMatches.has(a[0])) || a[1] - b[1])
    .map(([entry, score]) => ({
      room: entry.room,
      // Flipped so 1 = perfect match, matching the more intuitive
      // "higher is better" convention used elsewhere in this app (e.g. the
      // room search ranking), rather than Fuse's own 0-is-best convention.
      score: 1 - score,
      matchesTerm: termMatches.has(entry),
      isExact: entry === opens,
    }));
}
