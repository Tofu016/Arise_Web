import { useEffect, useRef, useState } from "react";
import { NODE_TYPES, TRANSITION_TYPES, allBuildings, floorLabel, floorsForBuilding, suggestNodeId, suggestedPhotoFilename } from "../utils/constants";
import { useCustomBuildingsVersion } from "../utils/buildingStore";
import { validateNode } from "../utils/validation";
import { useAutoId } from "../hooks/useAutoId";
import FaceReviewPanel from "./FaceReviewPanel";
import { photoFilename } from "../utils/photoStore";
import { startReview, reviewExisting, confirmReview, cancelReview } from "../utils/panoramaReview";

const emptyDraft = () => ({
  id: "",
  name: "",
  building: "gd1",
  floor: 1,
  type: "hallway",
  leadsToFloor: "",
  startingNode: false,
  photo: "",
  rooms: [],
  neighbors: [],
});

export default function NodeForm({ mode, node, nodes, onSave, onCancel, onDelete }) {
  useCustomBuildingsVersion(); // re-render when an admin-created building is added

  const [draft, setDraft] = useState(() =>
    mode === "edit" ? { ...node, rooms: node.rooms || [] } : emptyDraft()
  );
  const [errors, setErrors] = useState([]);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [roomInput, setRoomInput] = useState("");
  const fileInputRef = useRef();

  // Whether the ID field is still being auto-generated from Building/Floor/Type
  // (true for a fresh new node) vs. the admin having typed their own — once
  // they touch it directly, we stop overwriting it. Never auto-generates for
  // an existing node being edited; see the opt-in "Suggested ID" prompt instead.
  const { idAutoManaged, noteIdFieldChanged } = useAutoId(mode, node);

  // Photo upload feedback for the currently-picked file.
  const [copyState, setCopyState] = useState("idle"); // idle | copying | copied | error
  const [rescanning, setRescanning] = useState(false);
  // The in-progress blur review, or null. tempPath is set only for a
  // brand-new upload (needs cleanup after publish/cancel); reopening an
  // existing photo reuses its real path directly and has no temp file.
  const [review, setReview] = useState(null); // { imageBlob, storagePath, targetFilename, tempPath }

  useEffect(() => {
    if (mode === "edit") {
      setDraft({ ...node, rooms: node.rooms || [] });
    } else {
      // A fresh "New Node" form already has default Building/Floor/Type
      // selected — auto-fill the ID (and matching photo filename) right away
      // instead of leaving it blank until the admin touches a dropdown.
      const fresh = emptyDraft();
      fresh.id = suggestNodeId(fresh.building, fresh.floor, fresh.type, nodes);
      fresh.photo = suggestedPhotoFilename(fresh.id);
      setDraft(fresh);
    }
    setErrors([]);
    setPreviewUrl(null);
    setRoomInput("");
    setCopyState("idle");
  }, [mode, node]);

  const field = (key) => (e) => {
    const value = e.target ? e.target.value : e;

    if (key === "id") noteIdFieldChanged(value);

    setDraft((d) => {
      const next = { ...d, [key]: value };

      // Building has its own real floor range (GD1: 9 floors incl. UG, GD2: 10, GD3: 11) —
      // if the previously selected floor doesn't exist in the new building, fall back
      // to that building's first floor instead of leaving a stale/invalid value.
      if (key === "building") {
        const validFloors = floorsForBuilding(value);
        if (!validFloors.includes(Number(d.floor))) {
          next.floor = validFloors[0];
        }
        next.leadsToFloor = "";
      }

      // New nodes only: keep the ID in sync with Building/Floor/Type until the
      // admin types their own. Existing nodes are never auto-renamed here —
      // see the opt-in "Suggested ID" prompt below instead, since a silent
      // rename would cascade through every other node's neighbor list.
      if (mode === "create" && idAutoManaged && (key === "building" || key === "floor" || key === "type")) {
        next.id = suggestNodeId(next.building, Number(next.floor), next.type, nodes);
      }

      // Auto-suggest the photo filename from the ID, but only while the user
      // hasn't manually typed/uploaded a different one — avoid clobbering
      // intentional overrides.
      if (next.id !== d.id && (!d.photo || d.photo === suggestedPhotoFilename(d.id))) {
        next.photo = suggestedPhotoFilename(next.id);
      }

      return next;
    });
  };

  // Existing node, Building/Floor/Type changed since the form opened: offer a
  // rename instead of silently changing the ID out from under existing
  // neighbor links. Excludes the node's own current id from the "already
  // used" check so editing without actually changing type/floor doesn't
  // spuriously suggest a different number.
  const buildingFloorTypeChanged =
    mode === "edit" &&
    (draft.building !== node.building || Number(draft.floor) !== node.floor || draft.type !== node.type);
  const idSuggestion = buildingFloorTypeChanged
    ? suggestNodeId(draft.building, Number(draft.floor), draft.type, nodes, node.id)
    : null;
  const showIdSuggestion = idSuggestion && idSuggestion !== draft.id;

  const applyIdSuggestion = () => {
    setDraft((d) => {
      const next = { ...d, id: idSuggestion };
      if (!d.photo || d.photo === suggestedPhotoFilename(d.id)) {
        next.photo = suggestedPhotoFilename(idSuggestion);
      }
      return next;
    });
  };

  const handleFilePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Name the photo after the node's own ID (not the uploaded file's
    // original name) — see photoFilename for why.
    const targetFilename = photoFilename(file, draft.id);

    setCopyState("copying");
    try {
      // Uploads to a temporary, admin-only holding area first — the
      // photo isn't reachable through the normal viewing path until an
      // admin actually confirms it in the review panel below.
      const nextReview = await startReview(file, { building: draft.building, filename: targetFilename });
      setPreviewUrl(URL.createObjectURL(nextReview.imageBlob));
      setCopyState("idle");
      setReview(nextReview);
    } catch {
      setCopyState("error");
    }
  };

  const handleRescanExisting = async () => {
    if (!draft.photo) return;
    setRescanning(true);
    try {
      setReview(await reviewExisting(draft.photo));
    } catch (err) {
      alert(err.message || "Couldn't load the existing photo.");
    } finally {
      setRescanning(false);
    }
  };

  const handleReviewConfirm = async (blurredBlob) => {
    const current = review;
    setReview(null);
    setCopyState("copying");
    try {
      const { path, isNew } = await confirmReview(current, blurredBlob, { building: draft.building });
      if (isNew) setDraft((d) => ({ ...d, photo: path }));
      setCopyState("copied");
      setTimeout(() => setCopyState((s) => (s === "copied" ? "idle" : s)), 2500);
    } catch {
      setCopyState("error");
    }
  };

  const handleReviewCancel = () => {
    cancelReview(review);
    setReview(null);
    setCopyState("idle");
    setPreviewUrl(null);
  };

  const addRoom = () => {
    const val = roomInput.trim();
    if (!val) return;
    if ((draft.rooms || []).some((r) => r.toLowerCase() === val.toLowerCase())) {
      setRoomInput("");
      return; // already on this node, nothing to do
    }
    setDraft((d) => ({ ...d, rooms: [...(d.rooms || []), val] }));
    setRoomInput("");
  };

  const removeRoom = (room) => {
    setDraft((d) => ({ ...d, rooms: (d.rooms || []).filter((r) => r !== room) }));
  };

  const handleSave = () => {
    if (copyState === "copying") {
      setErrors(["The photo is still uploading — wait for it to finish before saving."]);
      return;
    }
    const normalized = {
      ...draft,
      floor: Number(draft.floor),
      leadsToFloor: draft.leadsToFloor === "" ? null : Number(draft.leadsToFloor),
    };
    const validationErrors = validateNode(normalized, nodes, mode === "edit" ? node.id : null);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSave(normalized, mode === "edit" ? node.id : null);
  };

  const isTransitionType = TRANSITION_TYPES.includes(draft.type);
  const currentStart = nodes.find(
    (n) => n.startingNode && n.building === draft.building && Number(n.floor) === Number(draft.floor)
  );

  return (
    <div className="panel node-form">
      <h3>{mode === "edit" ? "Edit Node" : "New Node"}</h3>

      <label>
        ID
        <input type="text" value={draft.id} onChange={field("id")} placeholder="gd1_f2_hallway_03" />
        {mode === "create" && idAutoManaged && (
          <span className="field-hint">
            Auto-filled from Building/Floor/Type — edit freely for a more descriptive name.
          </span>
        )}
        {showIdSuggestion && (
          <span className="field-hint">
            Building/Floor/Type changed since this node was created — suggested ID: <code>{idSuggestion}</code>{" "}
            <a href="#" onClick={(e) => { e.preventDefault(); applyIdSuggestion(); }}>Rename to match?</a>
          </span>
        )}
      </label>

      <label>
        Name
        <input type="text" value={draft.name} onChange={field("name")} placeholder="Hallway near Rm 203" />
      </label>

      <label>
        Building
        <select value={draft.building} onChange={field("building")}>
          {allBuildings().map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </select>
      </label>

      <label>
        Floor
        <select value={draft.floor} onChange={field("floor")}>
          {floorsForBuilding(draft.building).map((f) => (
            <option key={f} value={f}>{floorLabel(f)}</option>
          ))}
        </select>
      </label>

      <label>
        Type
        <select value={draft.type} onChange={field("type")}>
          {NODE_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </label>

      {isTransitionType && (
        <label>
          Leads to floor
          <select value={draft.leadsToFloor} onChange={field("leadsToFloor")}>
            <option value="">Select floor...</option>
            {floorsForBuilding(draft.building).filter((f) => f !== Number(draft.floor)).map((f) => (
              <option key={f} value={f}>{floorLabel(f)}</option>
            ))}
          </select>
        </label>
      )}

      <div className="starting-node-field">
        <label className="starting-node-toggle">
          <input
            type="checkbox"
            checked={!!draft.startingNode}
            onChange={(e) => field("startingNode")(e.target.checked)}
          />
          <span>Starting node for this floor</span>
        </label>
        <span className="field-hint">
          Where the kiosk drops visitors who pick this building floor. Only one per floor
          {currentStart && currentStart.id !== draft.id
            ? ` — saving this replaces ${currentStart.id}.`
            : "."}
        </span>
      </div>

      <div className="rooms-field">
        <label>Rooms served (optional)</label>
        <div className="room-chip-input">
          <input
            type="text"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRoom();
              }
            }}
            placeholder="e.g. 203"
          />
          <button type="button" onClick={addRoom}>Add</button>
        </div>
        <div className="room-chips">
          {(draft.rooms || []).length === 0 && (
            <span className="empty-hint">No rooms assigned yet.</span>
          )}
          {(draft.rooms || []).map((r) => (
            <span key={r} className="room-chip">
              {r}
              <button type="button" onClick={() => removeRoom(r)}>×</button>
            </span>
          ))}
        </div>
        <span className="field-hint">
          Rooms this hallway node serves — this is what search will match on later.
        </span>
      </div>

      <label>
        360° photo filename
        <input
          type="text"
          value={draft.photo}
          onChange={field("photo")}
          placeholder="gd1_f2_hallway_03.jpg"
        />
        <span className="field-hint">
          Set automatically once you pick a file below — only edit this by hand if you're linking to an existing upload.
        </span>
      </label>

      <label>
        Choose 360° photo file
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFilePick} />
        {!draft.id && (
          <span className="field-hint">Set an ID first so the uploaded photo can be named to match.</span>
        )}
        <span className="field-hint">
          {copyState === "copying" && "Uploading…"}
          {copyState === "copied" && "✓ Uploaded"}
          {copyState === "error" && "⚠ Upload failed — check your connection."}
          {copyState === "idle" && "Picking a file uploads it to a temporary holding area for review, then publishes it once confirmed."}
        </span>
      </label>

      {mode === "edit" && draft.photo && (
        <button
          type="button"
          className="rescan-faces-btn"
          onClick={handleRescanExisting}
          disabled={rescanning || copyState === "copying"}
        >
          {rescanning ? "Loading photo…" : "✏️ Edit blur regions on this photo"}
        </button>
      )}

      {previewUrl && (
        <img src={previewUrl} alt="preview" className="photo-preview" />
      )}

      {review && (
        <FaceReviewPanel
          imageBlob={review.imageBlob}
          storagePath={review.storagePath}
          onConfirm={handleReviewConfirm}
          onCancel={handleReviewCancel}
        />
      )}

      {/* Neighbor-linking removed from here deliberately — Navigation
          Editor is now the sole place this gets managed, per the admin
          redesign, avoiding two separate, duplicate ways to wire up the
          same connections. The node's own `neighbors` field is still
          carried through `draft` via the spread from `node` above, so
          saving from this form leaves existing connections untouched —
          it just no longer offers a way to edit them here. */}

      {errors.length > 0 && (
        <div className="error-box">
          {errors.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}

      <div className="form-actions">
        <button className="primary" onClick={handleSave} disabled={copyState === "copying"}>
          {copyState === "copying" ? "Waiting for photo upload…" : mode === "edit" ? "Save changes" : "Create node"}
        </button>
        {mode === "edit" && (
          <button className="danger" onClick={() => onDelete(node.id)}>Delete</button>
        )}
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
