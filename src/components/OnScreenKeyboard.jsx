import { useEffect, useRef, useState } from "react";
import { insertAt, backspaceAt } from "../utils/textEdit";

// A custom, in-app on-screen keyboard for the kiosk layout — built because
// there's no way for a website to directly force the OS's own virtual
// keyboard to appear. That's a deliberate web platform limitation, not a
// gap in this code; Windows specifically is known to sometimes skip
// auto-showing its touch keyboard on a device that still has a physical
// keyboard technically available, even when someone's genuinely
// interacting by touch — exactly the touchscreen-monitor-in-portrait case
// this was built for.
//
// Lives inside a KioskDialog, which supplies the text fields it serves: it
// types into whichever field of that dialog was focused last (or the first
// one), so one keyboard covers a form of several fields. The fields themselves
// should set inputMode="none" so the OS keyboard doesn't stack on top.
// It edits the real DOM field and fires a genuine input event, so React
// controlled inputs pick the change up through their normal onChange.
//
// Every key uses onMouseDown + preventDefault, not onClick — this is
// what stops the browser from blurring the currently-focused field the
// instant a key is tapped.
const SCOPE_SELECTOR = ".kiosk-dialog";
const FIELD_SELECTOR = "textarea, input:not([type]), input[type=text], input[type=email], input[type=search]";
const ROWS = ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm", "@.-_,?'!"].map((r) => r.split(""));

function setFieldValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  // The prototype's setter, not el.value = ..., or React's own value
  // tracking swallows the change as "nothing happened".
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function editField(el, edit) {
  let start = null;
  let end = null;
  try {
    start = el.selectionStart;
    end = el.selectionEnd;
  } catch {
    // type=email exposes no selection in some browsers.
  }
  if (start == null || end == null) start = end = el.value.length;
  const { value, caret } = edit(el.value, start, end);
  setFieldValue(el, value);
  try {
    el.setSelectionRange(caret, caret);
  } catch {
    // Same: the caret just stays wherever the browser leaves it.
  }
}

export default function OnScreenKeyboard() {
  const rootRef = useRef(null);
  const fieldRef = useRef(null);
  const [shift, setShift] = useState(false);

  useEffect(() => {
    const scope = rootRef.current?.closest(SCOPE_SELECTOR);
    if (!scope) return;
    const remember = (e) => {
      if (e.target.matches?.(FIELD_SELECTOR)) fieldRef.current = e.target;
    };
    scope.addEventListener("focusin", remember);
    const active = document.activeElement;
    if (scope.contains(active) && active.matches(FIELD_SELECTOR)) fieldRef.current = active;
    return () => scope.removeEventListener("focusin", remember);
  }, []);

  // The field to type into: the last one focused here, else the first.
  // Re-focused if a button press moved focus away from it.
  const target = () => {
    let el = fieldRef.current;
    if (!el?.isConnected) {
      el = rootRef.current?.closest(SCOPE_SELECTOR)?.querySelector(FIELD_SELECTOR) ?? null;
      fieldRef.current = el;
    }
    if (el && document.activeElement !== el) el.focus();
    return el;
  };

  const press = (char) => {
    const el = target();
    if (!el) return;
    editField(el, (value, start, end) => insertAt(value, start, end, shift ? char.toUpperCase() : char));
    setShift(false);
  };
  // A line break in the comments box; in a single-line field there's
  // nothing to break, so it moves on to the next field instead.
  const enter = () => {
    const el = target();
    if (!el) return;
    if (el instanceof HTMLTextAreaElement) {
      editField(el, (value, start, end) => insertAt(value, start, end, "\n"));
      return;
    }
    const fields = [...(el.closest(SCOPE_SELECTOR)?.querySelectorAll(FIELD_SELECTOR) ?? [])];
    fields[fields.indexOf(el) + 1]?.focus();
  };
  const backspace = () => {
    const el = target();
    if (el) editField(el, backspaceAt);
  };

  return (
    <div className="onscreen-keyboard" ref={rootRef} onMouseDown={(e) => e.preventDefault()}>
      {ROWS.map((row, i) => (
        <div className="onscreen-keyboard-row" key={i}>
          {row.map((k) => (
            <button
              key={k}
              type="button"
              className="onscreen-keyboard-key"
              onMouseDown={(e) => { e.preventDefault(); press(k); }}
            >
              {shift ? k.toUpperCase() : k}
            </button>
          ))}
        </div>
      ))}
      <div className="onscreen-keyboard-row onscreen-keyboard-bottom-row">
        <button
          type="button"
          className={"onscreen-keyboard-key onscreen-keyboard-shift" + (shift ? " onscreen-keyboard-shift-active" : "")}
          onMouseDown={(e) => { e.preventDefault(); setShift((s) => !s); }}
          aria-label="Shift"
          aria-pressed={shift}
        >
          ⇧
        </button>
        <button
          type="button"
          className="onscreen-keyboard-key onscreen-keyboard-space"
          onMouseDown={(e) => { e.preventDefault(); press(" "); }}
        >
          Space
        </button>
        <button
          type="button"
          className="onscreen-keyboard-key onscreen-keyboard-enter"
          onMouseDown={(e) => { e.preventDefault(); enter(); }}
          aria-label="Enter"
        >
          ↵
        </button>
        <button
          type="button"
          className="onscreen-keyboard-key onscreen-keyboard-backspace"
          onMouseDown={(e) => { e.preventDefault(); backspace(); }}
          aria-label="Backspace"
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
