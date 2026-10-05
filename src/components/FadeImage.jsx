import { useState } from "react";

// An <img> that fades in once decoded instead of popping into an empty box.
// Errors also reveal it, so a broken image never stays invisible.
export default function FadeImage({ className = "", onLoad, onError, ...rest }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      {...rest}
      className={`fade-img${loaded ? " is-loaded" : ""} ${className}`.trim()}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      onError={(e) => {
        setLoaded(true);
        onError?.(e);
      }}
    />
  );
}
