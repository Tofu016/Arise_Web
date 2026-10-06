import { createContext, useContext } from "react";

// Provided by ConfirmProvider (ConfirmContext.jsx), mounted in AdminLayout.
export const ConfirmContext = createContext(null);

// const { confirm, alert } = useConfirm();
// if (!(await confirm({ title, message, confirmLabel, danger: true }))) return;
// Both resolve once the dialog closes; confirm resolves true/false.
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
