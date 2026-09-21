// Pure text edits behind the on-screen keyboard: `start`/`end` are the
// field's selection (equal for a plain caret). Each returns the new value
// and where the caret belongs afterwards.
export function insertAt(value, start, end, text) {
  return { value: value.slice(0, start) + text + value.slice(end), caret: start + text.length };
}

export function backspaceAt(value, start, end) {
  if (start !== end) return { value: value.slice(0, start) + value.slice(end), caret: start };
  if (start === 0) return { value, caret: 0 };
  return { value: value.slice(0, start - 1) + value.slice(start), caret: start - 1 };
}

// Whether the next letter typed at `caret` should be a capital, for the two
// keyboards:
//   "words"     the start of every word — at the start of the text, or after
//               whitespace or a dash (an apostrophe doesn't count: "Don't")
//   "sentences" the start of the text, or after . ! or ? (plus any closing
//               quote/bracket) followed by whitespace — so "example.com" and
//               "3.5" are left alone
export function shouldCapitalize(text, caret, mode) {
  const before = text.slice(0, caret);
  if (mode === "words") return before === "" || /[\s-]$/.test(before);
  return /^\s*$/.test(before) || /[.!?]["')\]]*\s+$/.test(before);
}
