import { useEffect, useState } from "react";
import { suggestTourStopId, suggestedTourPanoramaFilename } from "../utils/tourConstants";
import { photoFilename, uploadPhoto } from "../utils/photoStore";
import { useAutoId } from "../hooks/useAutoId";
import { useBlurReview } from "../hooks/useBlurReview";
import FilePickerButton from "./FilePickerButton";
import { useToast } from "../context/ToastContext";

const emptyDraft = () => ({
  id: "",
  name: "",
  section: "",
  photo: "",
  neighbors: [],
});

// Tour Stop equivalent of NodeForm.jsx — deliberately much simpler, since
// a tour stop has no building/floor/type/rooms-served. Its photo goes
// through the manual blur review (useBlurReview) before it's uploaded, but
// not NodeForm.jsx's server-side holding-area flow. Neighbor-linking is likewise not
// edited here — same separation as the indoor system, where Navigation
// Edit is the sole place that's managed.
export default function TourStopForm({ mode, stop, stops, sections, onSave, onCancel, onDelete }) {
  const [draft, setDraft] = useState(() =>
    mode === "edit" ? { ...stop } : emptyDraft()
  );
  const [errors, setErrors] = useState([]);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadState, setUploadState] = useState("idle"); // idle | uploading | done | error
  const { requestBlur, reblurStored, blurDialog } = useBlurReview();
  const toast = useToast();

  // "Edit blur regions" on the stop's already-uploaded panorama. Saves over
  // it; if that lands on a different path (old .jpg re-saved as .webp) the
  // form adopts the new one and Save stores it on the stop.
  const handleReblur = async () => {
    try {
      const saved = await reblurStored(draft.photo);
      if (!saved) return;
      setDraft((d) => ({ ...d, photo: saved.path }));
      setUploadState("done");
      setTimeout(() => setUploadState((s) => (s === "done" ? "idle" : s)), 2500);
      toast.success("Blur regions updated.");
    } catch (err) {
      toast.error(err.message || "Couldn't update the photo.");
    }
  };

  // Same "auto-manage until the admin types their own" behavior as
  // NodeForm.jsx's ID field — true only for a fresh new stop.
  const { idAutoManaged, noteIdFieldChanged } = useAutoId(mode, stop);

  useEffect(() => {
    if (mode === "edit") {
      setDraft({ ...stop });
    } else {
      const fresh = emptyDraft();
      fresh.section = sections[0]?.id || "";
      setDraft(fresh);
    }
    setErrors([]);
    setPreviewUrl(null);
    setUploadState("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, stop]);

  const field = (key) => (e) => {
    const value = e.target ? e.target.value : e;

    if (key === "id") noteIdFieldChanged(value);

    setDraft((d) => {
      const next = { ...d, [key]: value };

      if (mode === "create" && idAutoManaged && key === "name") {
        next.id = suggestTourStopId(value, stops);
      }

      // Auto-suggest the photo filename from the ID, same as NodeForm.jsx,
      // only while nothing's been manually typed/uploaded yet.
      if (next.id !== d.id && (!d.photo || d.photo === suggestedTourPanoramaFilename(d.id))) {
        next.photo = suggestedTourPanoramaFilename(next.id);
      }

      return next;
    });
  };

  // Existing stop, Name changed since the form opened: offer a rename
  // instead of silently changing the ID out from under existing neighbor
  // links — same pattern as NodeForm.jsx's own idSuggestion prompt.
  const idSuggestion =
    mode === "edit" && draft.name !== stop.name
      ? suggestTourStopId(draft.name, stops, stop.id)
      : null;
  const showIdSuggestion = idSuggestion && idSuggestion !== draft.id;

  const applyIdSuggestion = () => {
    setDraft((d) => {
      const next = { ...d, id: idSuggestion };
      if (!d.photo || d.photo === suggestedTourPanoramaFilename(d.id)) {
        next.photo = suggestedTourPanoramaFilename(idSuggestion);
      }
      return next;
    });
  };

  const handleFilePick = async (e) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = ""; // so picking the same file again (e.g. after Cancel) still fires
    if (!file) return;

    // Named after the stop's own ID, not the section — a section is just
    // a grouping label, not a guaranteed-unique scope the way a building
    // is for room photos, so keying off the stop's own id (which IS
    // guaranteed unique) avoids any filename collision risk between two
    // differently-named stops.
    const targetFilename = photoFilename(file, draft.id);

    try {
      const reviewed = await requestBlur(file); // blur review first; null = cancelled
      if (!reviewed) return;
      setUploadState("uploading");
      setPreviewUrl(URL.createObjectURL(reviewed));
      const { path } = await uploadPhoto("tourPanorama", reviewed, { filename: targetFilename });
      setDraft((d) => ({ ...d, photo: path }));
      setUploadState("done");
      setTimeout(() => setUploadState((s) => (s === "done" ? "idle" : s)), 2500);
    } catch (err) {
      setUploadState("error");
      toast.error(err.message || "Couldn't upload the panorama.");
    }
  };

  const handleSave = () => {
    if (uploadState === "uploading") {
      setErrors(["The photo is still uploading — wait for it to finish before saving."]);
      return;
    }
    const trimmedName = draft.name.trim();
    const trimmedId = draft.id.trim();
    const validationErrors = [];
    if (!trimmedName) validationErrors.push("Name can't be empty.");
    if (!trimmedId) validationErrors.push("ID can't be empty.");
    // Section is no longer required — a stop with none groups under
    // "Uncategorized" on the public page's sidebar instead of being
    // left without any way for a visitor to actually reach it.
    const idTaken = stops.some((s) => s.id === trimmedId && s.id !== (mode === "edit" ? stop.id : null));
    if (idTaken) validationErrors.push(`ID "${trimmedId}" is already used by another stop.`);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSave({ ...draft, name: trimmedName, id: trimmedId }, mode === "edit" ? stop.id : null);
  };

  return (
    <div className="panel node-form">
      <h3>{mode === "edit" ? "Edit Tour Stop" : "New Tour Stop"}</h3>

      <label>
        ID
        <input type="text" value={draft.id} onChange={field("id")} placeholder="tour_main_gate_01" />
        {mode === "create" && idAutoManaged && (
          <span className="field-hint">Auto-filled from Name — edit freely for a more descriptive ID.</span>
        )}
        {showIdSuggestion && (
          <span className="field-hint">
            Name changed since this stop was created — suggested ID: <code>{idSuggestion}</code>{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); applyIdSuggestion(); }}>Rename to match?</a>
          </span>
        )}
      </label>

      <label>
        Name
        <input type="text" value={draft.name} onChange={field("name")} placeholder="Main Gate" />
      </label>

      <label>
        Section
        <select value={draft.section} onChange={field("section")}>
          <option value="">— No section —</option>
          {sections.map((sec) => (
            <option key={sec.id} value={sec.id}>{sec.label}</option>
          ))}
        </select>
        <span className="field-hint">
          Optional — a stop with no section groups under "Uncategorized" on the public tour page's sidebar.
        </span>
      </label>

      <label>
        360° photo
        <FilePickerButton accept="image/*" onChange={handleFilePick} disabled={uploadState === "uploading"} />
        <span className="field-hint">
          {uploadState === "uploading" && "Uploading…"}
          {uploadState === "done" && "✓ Uploaded"}
          {uploadState === "error" && "⚠ Upload failed — check Storage rules/connection."}
          {uploadState === "idle" && !draft.photo && "No photo set yet."}
        </span>
      </label>

      {mode === "edit" && draft.photo && (
        <button
          type="button"
          className="rescan-faces-btn"
          onClick={handleReblur}
          disabled={uploadState === "uploading"}
        >
          ✏️ Edit blur regions on this photo
        </button>
      )}

      {previewUrl && (
        <img src={previewUrl} alt="preview" className="photo-preview" />
      )}

      {errors.length > 0 && (
        <div className="error-box">
          {errors.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}

      <div className="form-actions">
        <button className="primary" onClick={handleSave} disabled={uploadState === "uploading"}>
          {uploadState === "uploading" ? "Waiting for photo upload…" : mode === "edit" ? "Save changes" : "Create stop"}
        </button>
        {mode === "edit" && (
          <button className="danger" onClick={() => onDelete(stop.id)}>Delete</button>
        )}
        <button onClick={onCancel}>Cancel</button>
      </div>

      {blurDialog}
    </div>
  );
}
