import { useEffect, useState } from "react";

// Keeps a conditionally rendered subtree mounted for `ms` after `show`
// flips false, tagging it so motion.css can fade it out (the same delayed
// unmount LoadingScreen does for itself). Children from the last render
// where `show` was true are what stays on screen during the exit, so
// callers can pass `{cond && <Thing data={x} />}` without Thing seeing
// null data mid-exit. `display: contents` keeps the wrapper out of layout,
// so fixed/absolute children position exactly as they did unwrapped.
export default function Presence({ show, ms = 160, children }) {
  const [mounted, setMounted] = useState(show);
  const [lastChildren, setLastChildren] = useState(children);

  // Adjusted during render (not in an effect) so a reopen never paints a
  // frame of the old, closing subtree.
  if (show && !mounted) setMounted(true);
  if (show && children && children !== lastChildren) setLastChildren(children);

  useEffect(() => {
    if (show) return;
    const t = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [show, ms]);

  if (!show && !mounted) return null;
  const content = show && children ? children : lastChildren;
  return <div className={"presence" + (show ? "" : " presence-exit")}>{content}</div>;
}
