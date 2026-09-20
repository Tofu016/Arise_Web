import { useState } from "react";
import { useTourSections } from "../hooks/useTourSections";
import { photoFilename, uploadPhoto } from "../utils/photoStore";
import { useSecurePhotoUrl } from "../hooks/useSecurePhotoUrl";
import { useBlurReview } from "../hooks/useBlurReview";
import FilePickerButton from "./FilePickerButton";

// Section equivalent of AddBuildingDialog.jsx — same "Add New X" /
// "Existing X/s" two-column structure and exact CSS classes
// (.add-building-columns, .add-building-form-col, etc.), and now the
// same actual modal shape too: triggered from Tour Stops' own toolbar,
// same position "New Building" occupies next to "New Node" in Node
// Editor. Was its own full sidebar page before this — now converted
// to a popup, selection-independent (doesn't operate on whichever stop
// happens to be selected, just manages sections generally, same as New
// Building isn't tied to whichever node is selected either).
export default function SectionEditorModal({ onClose }) {
  const { sections, addSection, deleteSection } = useTourSections();

  const [label, setLabel] = useState("");
  const [coverPath, setCoverPath] = useState("");
  const [uploadState, setUploadState] = useState("idle"); // idle | uploading | done | error
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const [coverVersion, setCoverVersion] = useState(0); // bumped when the cover is edited in place
  const { url: coverPreviewUrl } = useSecurePhotoUrl(coverPath, { version: coverVersion });
  const { requestBlur, reblurStored, blurDialog } = useBlurReview();

  // "Edit blur regions" on the cover that's already uploaded.
  const handleCoverReblur = async () => {
    try {
      const saved = await reblurStored(coverPath);
      if (!saved) return;
      setCoverPath(saved.path);
      setCoverVersion((v) => v + 1);
    } catch (err) {
      setError(err.message || "Couldn't update the photo.");
    }
  };

  const handleCoverPick = async (e) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = ""; // so picking the same file again (e.g. after Cancel) still fires
    if (!file) return;
    const filename = photoFilename(file, String(Date.now()));
    try {
      const reviewed = await requestBlur(file); // blur review first; null = cancelled
      if (!reviewed) return;
      setUploadState("uploading");
      const { path } = await uploadPhoto("tourCover", reviewed, { filename });
      setCoverPath(path);
      setUploadState("done");
      setTimeout(() => setUploadState((s) => (s === "done" ? "idle" : s)), 2500);
    } catch {
      setUploadState("error");
    }
  };

  const handleCreate = async () => {
    setError("");
    setCreating(true);
    try {
      await addSection({ label, coverPhoto: coverPath });
      setLabel("");
      setCoverPath("");
    } catch (err) {
      setError(err.message || "Couldn't create the section.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (section) => {
    if (!confirm(`Delete section "${section.label}"? Tour stops assigned to it won't be deleted, but will lose their section grouping until reassigned.`)) return;
    try {
      await deleteSection(section.id);
    } catch (err) {
      setError(err.message || "Couldn't delete the section.");
    }
  };

  return (
    <>
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal add-building-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <h3>Section Editor</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="add-building-columns">
          <div className="add-building-form-col">
            <h4 className="add-building-subheading">Add New Section</h4>

            <label>
              Section name
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. SWU PHINMA Main Campus"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </label>

            <label>
              Cover photo <span className="field-hint" style={{ display: "inline" }}>(optional)</span>
              <span className="field-hint">Shown on the public tour page's sidebar for this section.</span>
            </label>
            <FilePickerButton accept="image/*" onChange={handleCoverPick} disabled={uploadState === "uploading"} />
            <span className="field-hint">
              {uploadState === "uploading" && "Uploading…"}
              {uploadState === "done" && "✓ Uploaded"}
              {uploadState === "error" && "⚠ Upload failed — check Storage rules/connection."}
              {uploadState === "idle" && !coverPath && "No cover photo set yet."}
            </span>
            {coverPath && (
              <button
                type="button"
                className="rescan-faces-btn"
                onClick={handleCoverReblur}
                disabled={uploadState === "uploading"}
              >
                ✏️ Edit blur regions on this photo
              </button>
            )}
            {coverPath && coverPreviewUrl && (
              <img src={coverPreviewUrl} alt="Cover preview" className="photo-preview" />
            )}
          </div>

          <div className="add-building-existing-col">
            <h4 className="add-building-subheading">Existing Section/s</h4>
            {sections.length === 0 ? (
              <p className="empty-hint">No sections yet — add one on the left.</p>
            ) : (
              <div className="custom-building-list">
                {sections.map((sec) => (
                  <div key={sec.id} className="custom-building-row">
                    <span>{sec.label}</span>
                    <button type="button" className="danger" onClick={() => handleDelete(sec)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="error-box">
            <p>{error}</p>
          </div>
        )}

        <div className="form-actions">
          <button className="primary" onClick={handleCreate} disabled={creating || uploadState === "uploading"}>
            {creating ? "Creating…" : "Create section"}
          </button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
    {/* Outside the overlay above: a click on the review dialog's backdrop
        would otherwise bubble up and close this whole modal. */}
    {blurDialog}
    </>
  );
}
