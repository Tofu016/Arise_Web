// A custom, in-app on-screen keyboard — built because there's no way for
// a website to directly force the OS's own virtual keyboard to appear.
// That's a deliberate web platform limitation, not a gap in this code;
// Windows specifically is known to sometimes skip auto-showing its touch
// keyboard on a device that still has a physical keyboard technically
// available, even when someone's genuinely interacting by touch — exactly
// the touchscreen-monitor-in-portrait case this was built for.
//
// Every key uses onMouseDown + preventDefault, not onClick — this is
// what stops the browser from blurring the currently-focused search
// input the instant a key is tapped. Without this, tapping any key
// would immediately close the search panel this keyboard lives inside,
// since the input's own onBlur handler closes it on focus loss.
const ROWS = [
  "1234567890".split(""),
  "QWERTYUIOP".split(""),
  "ASDFGHJKL".split(""),
  "ZXCVBNM".split(""),
];

export default function OnScreenKeyboard({ value, onChange, onClose }) {
  // Guards against a stray mousedown on the keyboard's own background
  // (between keys, or on a row) also bubbling up and triggering
  // something else that expects a real blur to have happened.
  const stopBlur = (e) => e.preventDefault();

  const press = (char) => onChange(value + char);
  const backspace = () => onChange(value.slice(0, -1));

  return (
    <div className="onscreen-keyboard" onMouseDown={stopBlur}>
      {ROWS.map((row, i) => (
        <div className="onscreen-keyboard-row" key={i}>
          {row.map((k) => (
            <button
              key={k}
              type="button"
              className="onscreen-keyboard-key"
              onMouseDown={(e) => { e.preventDefault(); press(k); }}
            >
              {k}
            </button>
          ))}
        </div>
      ))}
      <div className="onscreen-keyboard-row onscreen-keyboard-bottom-row">
        <button
          type="button"
          className="onscreen-keyboard-key onscreen-keyboard-space"
          onMouseDown={(e) => { e.preventDefault(); press(" "); }}
        >
          Space
        </button>
        <button
          type="button"
          className="onscreen-keyboard-key onscreen-keyboard-backspace"
          onMouseDown={(e) => { e.preventDefault(); backspace(); }}
          aria-label="Backspace"
        >
          ⌫
        </button>
        <button
          type="button"
          className="onscreen-keyboard-key onscreen-keyboard-done"
          onMouseDown={(e) => { e.preventDefault(); onClose(); }}
        >
          Done
        </button>
      </div>
    </div>
  );
}
