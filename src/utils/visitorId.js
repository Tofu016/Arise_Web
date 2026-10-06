// A random id for this browser, sent with feedback so Arise_API's 30 second
// limit counts one visitor, not everyone behind the campus's shared IP. Kept
// in localStorage so a reload does not hand out a fresh allowance; if storage
// is blocked it lives for the page only, which is still enough to throttle a
// visitor who stays on it. Not an identity: it is never joined to anything.
import { uuid } from "./uuid";

const KEY = "visitorId";
let fallback = null;

export function getVisitorId() {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored) return stored;
    const id = uuid();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    fallback ??= uuid();
    return fallback;
  }
}
