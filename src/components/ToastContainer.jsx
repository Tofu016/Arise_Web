import { useToast } from "../context/ToastContext";
import checkIcon from "../assets/icons/check.svg";
import infoIcon from "../assets/icons/info.svg";
import IconPlaceholder from "./IconPlaceholder";

// White icons for the colored .toast-icon badge (success/error/warning/info
// backgrounds, color: var(--white) — see index.css's Toasts section).
// warning/close come from the shared grey/white icon set; check/info don't
// exist there yet, so they're one-off imports like menuIcon/powerIcon in
// MainPage.jsx.
const ICONS = {
  success: <img src={checkIcon} alt="" className="inline-icon-img" />,
  error: <IconPlaceholder name="close" variant="white" className="inline-icon-img" />,
  warning: <IconPlaceholder name="warning-triangle" variant="white" className="inline-icon-img" />,
  info: <img src={infoIcon} alt="" className="inline-icon-img" />,
};

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
            <IconPlaceholder name="close" className="inline-icon-img" />
          </button>
        </div>
      ))}
    </div>
  );
}
