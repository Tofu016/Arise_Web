import { useToast } from "../context/ToastContext";

const ICONS = { success: "✓", error: "✕", warning: "⚠", info: "ℹ" };

// Fixed stack, bottom-right, above every modal (see index.css's Toasts
// section for the z-index) — mounted once in App.jsx, not per-page.
export default function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon" aria-hidden="true">{ICONS[t.type]}</span>
          <span className="toast-message">{t.message}</span>
          <button type="button" className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
