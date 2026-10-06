import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import IconPlaceholder from "../components/IconPlaceholder";
import { ConfirmContext } from "./useConfirm";

// In-app replacement for window.confirm/window.alert in the admin CMS. The
// native dialogs render in the browser's own chrome (and say "localhost
// says"), so they can't match the CMS. Mounted inside .admin-layout so the
// dialog picks up the admin button/radius overrides.
export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const confirmBtnRef = useRef(null);

  const open = useCallback(
    (options, alertOnly) =>
      new Promise((resolve) => {
        const opts = typeof options === "string" ? { message: options } : options;
        setDialog({ ...opts, alertOnly, resolve, returnFocus: document.activeElement });
      }),
    []
  );

  // Stable identity (open never changes), so callers can list confirm in a
  // dependency array without re-running on every render.
  const api = useMemo(
    () => ({
      confirm: (options) => open(options, false),
      alert: (options) => open(options, true),
    }),
    [open]
  );

  const close = useCallback(
    (result) => {
      if (!dialog) return;
      dialog.resolve(result);
      // Put focus back where the admin was (e.g. the row's Delete button),
      // as the native dialog does.
      dialog.returnFocus?.focus?.();
      setDialog(null);
    },
    [dialog]
  );

  useEffect(() => {
    if (!dialog) return;
    confirmBtnRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(dialog.alertOnly);
      }
    };
    // Capture phase so Escape closes this dialog, not a modal under it
    // (AddBuildingDialog, FlowchartView) that also listens for it.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [dialog, close]);

  const {
    title,
    message,
    confirmLabel = dialog?.alertOnly ? "OK" : "Confirm",
    cancelLabel = "Cancel",
    danger = false,
  } = dialog || {};

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {dialog && (
        <div className="modal-overlay confirm-dialog-overlay" onClick={() => close(dialog.alertOnly)}>
          <div
            className="modal confirm-dialog"
            role={dialog.alertOnly || danger ? "alertdialog" : "dialog"}
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="preview-header">
              <h3 id="confirm-dialog-title">{title || (dialog.alertOnly ? "Notice" : "Are you sure?")}</h3>
              <button type="button" className="close-btn" onClick={() => close(dialog.alertOnly)} aria-label="Close">
                <IconPlaceholder name="close" className="create-user-close-icon" />
              </button>
            </div>

            <div id="confirm-dialog-message" className="confirm-dialog-message">
              {String(message ?? "")
                .split(/\n{2,}/)
                .map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
            </div>

            <div className="form-actions confirm-dialog-actions">
              {!dialog.alertOnly && (
                <button type="button" className="admin-btn-secondary" onClick={() => close(false)}>
                  {cancelLabel}
                </button>
              )}
              <button
                type="button"
                ref={confirmBtnRef}
                className={danger ? "danger" : "primary"}
                onClick={() => close(true)}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
