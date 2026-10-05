import { useRef } from "react";

// A real, custom-styled button — not the browser's own native
// "Choose File" chrome, which can't be styled consistently across
// browsers. Triggers a visually-hidden native <input type="file"> via a
// ref; the actual file-picking dialog/behavior stays completely
// standard, only the trigger's own appearance is replaced.
export default function FilePickerButton({ onChange, accept = "image/*", multiple, disabled, label = "Choose Photo" }) {
  const inputRef = useRef(null);

  return (
    <span className="file-picker">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        disabled={disabled}
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
