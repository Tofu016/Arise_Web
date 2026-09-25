import { useEffect, useState } from "react";

// Description Edit, converted from its own full sidebar page into a
// popup — triggered from Tour Stops' own toolbar, operating on whichever
// stop is currently selected there (disabled if nothing is), rather
// than carrying its own separate list+selection UI the way the page
// version did. No Section filter here either, for the same reason — a
// selection-scoped popup doesn't need to browse/filter anything, it
// just edits the one stop it was opened for. Uses .room-edit-modal's
// original modal styling — the same class the indoor Room Editor used
// for its own modal before IT was promoted to a full page; fitting to
// reuse it here, going the opposite direction.
export default function DescriptionEditModal({ stop, onSave, onClose }) {
  const [draft, setDraft] = useState(stop.description || "");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setDraft(stop.description || "");
  }, [stop.id]);

  const isDirty = draft !== (stop.description || "");

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(stop.id, { description: draft });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal room-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <h3>Description: {stop.name}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <label>
          Description
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            placeholder="What is this facility and what does it offer? Shown to visitors on the public tour page."
          />
        </label>

        <div className="form-actions">
          <button className="primary" onClick={handleSave} disabled={saving || !isDirty}>
            {saving ? "Saving…" : savedFlash ? "✓ Saved" : "Save"}
          </button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
