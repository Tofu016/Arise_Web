import { useRef } from "react";

// A real, custom-styled button — not the browser's own native
// "Choose File" chrome, which can't be styled consistently across
// browsers. Triggers a visually-hidden native <input type="file"> via a
// ref; the actual file-picking dialog/behavior stays completely
// standard, only the trigger's own appearance is replaced.
// `multiple` is optional and defaults to unset (single-file, the
// original behavior every existing caller relies on) — added for the
// Virtual Tour's equipment-marker photo carousel, which needs to let an
// admin pick several photos in one go rather than one at a time.
export default function FilePickerButton({ onChange, accept = "image/*", disabled, label = "Choose Photo", multiple }) {
  const inputRef = useRef(null);

  return (
    <span className="file-picker">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onChange}
        disabled={disabled}
        multiple={multiple}
        className="file-picker-hidden-input"
      />
      <button
        type="button"
        className="file-picker-btn"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        {label}
      </button>
    </span>
  );
}
