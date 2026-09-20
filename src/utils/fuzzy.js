// Forgiving text matching shared by every search box.
//
// Everything is compared in a normalized form — lowercase, accents and
// diacritics dropped, and every space and punctuation mark removed — so
// "Main Entrance", "main-entrance" and "MAINENTRANCE" are the same thing, as
// are "203-A" and "203a".
//
// On top of that, a query of letters only tolerates a few typos (see
// allowedEdits), counting a swap of two neighboring letters as one. Anything
// containing a digit never does: "203" must not find room "208".
export function normalize(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

// How many typos a normalized query may contain, by length: short words are
// too easily confused with other words to bend at all.
export function allowedEdits(query) {
  if (/\d/.test(query)) return 0;
  if (query.length >= 7) return 2;
  if (query.length >= 4) return 1;
  return 0;
}

// The fewest edits (insert, delete, substitute, or swap two adjacent
// letters) that turn `query` into SOME contiguous piece of `text`. That's
// the standard edit-distance table with a free start anywhere in the text.
export function approximateSubstringDistance(query, text) {
  const m = query.length;
  const n = text.length;
  if (m === 0) return 0;
  let prevPrev = null;
  let prev = Array.from({ length: n + 1 }, () => 0); // row 0: matching nothing yet costs nothing
  for (let i = 1; i <= m; i++) {
    const row = [i];
    for (let j = 1; j <= n; j++) {
      const cost = query[i - 1] === text[j - 1] ? 0 : 1;
      let best = Math.min(prev[j - 1] + cost, prev[j] + 1, row[j - 1] + 1);
      if (i > 1 && j > 1 && query[i - 1] === text[j - 2] && query[i - 2] === text[j - 1]) {
        best = Math.min(best, prevPrev[j - 2] + 1);
      }
      row.push(best);
    }
    prevPrev = prev;
    prev = row;
  }
  return Math.min(...prev);
}

// How well `text` matches an already-normalized `query`; lower is better,
// Infinity is no match. The tier (tens digit) says how it matched:
//   0 identical · 1 starts with it · 2 contains it · 3 close, with typos.
// Within the last tier the ones digit is the number of typos.
export function matchScore(query, text, { fuzzy = true } = {}) {
  if (!query) return Infinity;
  const t = normalize(text);
  if (t === query) return 0;
  if (t.startsWith(query)) return 10;
  if (t.includes(query)) return 20;
  if (!fuzzy) return Infinity;
  const budget = allowedEdits(query);
  if (budget === 0) return Infinity;
  const edits = approximateSubstringDistance(query, t);
  return edits <= budget ? 30 + edits : Infinity;
}

export const isFuzzyScore = (score) => score >= 30 && score !== Infinity;

// Best score of a query against several texts.
export function bestScore(query, texts, options) {
  let best = Infinity;
  for (const text of texts) best = Math.min(best, matchScore(query, text, options));
  return best;
}

// Does the query match any of the texts, forgivingly? For plain filters that
// don't rank. A blank query matches everything.
export function fuzzyIncludes(rawQuery, texts, options) {
  const query = normalize(rawQuery);
  if (!query) return true;
  return bestScore(query, texts, options) !== Infinity;
}
