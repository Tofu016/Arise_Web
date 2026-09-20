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
