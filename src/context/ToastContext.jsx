import { createContext, useCallback, useContext, useRef, useState } from "react";

// App-wide toast queue. Mounted once at the root (App.jsx) so any hook or
// component — admin CRUD hooks especially — can report a success/failure
// without threading a callback down through props. Public-facing code
// simply never calls it, so it's safe to have this available everywhere.
const ToastContext = createContext(null);

let nextId = 0;

// error/warning stay up longer than success/info — a mistake worth reading
// twice shouldn't vanish as fast as a routine confirmation.
const DEFAULT_DURATION = { success: 4000, info: 4000, warning: 5500, error: 6500 };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (type, message, duration) => {
      if (!message) return null;
      const id = ++nextId;
      setToasts((t) => [...t, { id, type, message }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration ?? DEFAULT_DURATION[type])
      );
      return id;
    },
    [dismiss]
  );

  // Stable identity across renders (ref, not useMemo) so components that
  // destructure { success, error } into a useCallback dependency array
  // don't get a new function every render.
  const api = useRef({
    success: (message, duration) => push("success", message, duration),
    error: (message, duration) => push("error", message, duration),
    warning: (message, duration) => push("warning", message, duration),
    info: (message, duration) => push("info", message, duration),
    dismiss,
  }).current;

  return <ToastContext.Provider value={{ toasts, ...api }}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be called within a ToastProvider");
  }
  return ctx;
}
