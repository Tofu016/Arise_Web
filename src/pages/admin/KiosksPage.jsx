import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useKiosks } from "../../hooks/useKiosks";
import { fuzzyIncludes } from "../../utils/fuzzy";
import IconPlaceholder from "../../components/IconPlaceholder";
import { buildingLabel, floorLabel } from "../../utils/constants";
import { useConfirm } from "../../context/useConfirm";

// A kiosk that has checked in within two heartbeats (see useKioskIdentity)
// counts as online. Both sides are the server's own clock strings, so the
// admin's timezone doesn't matter.
const ONLINE_WITHIN_MS = 10 * 60 * 1000;
const parseServerTime = (s) => Date.parse(String(s).replace(" ", "T"));

function kioskStatus(kiosk, serverTime) {
  if (kiosk.paired) {
    const online = kiosk.lastSeenAt && parseServerTime(serverTime) - parseServerTime(kiosk.lastSeenAt) <= ONLINE_WITHIN_MS;
    return online ? { id: "live", label: "Online" } : { id: "ended", label: "Offline" };
  }
  if (kiosk.codePending && parseServerTime(kiosk.codeExpiresAt) > parseServerTime(serverTime)) {
    return { id: "scheduled", label: "Waiting to pair" };
  }
  return { id: "off", label: "Not paired" };
}

function describeSeen(kiosk) {
  if (!kiosk.paired) return "Never paired";
  return kiosk.lastSeenAt ? `Last seen ${kiosk.lastSeenAt}` : "Not seen yet";
}

function nodeOptionLabel(n) {
  return `${n.name} (${buildingLabel(n.building)}, ${floorLabel(n.floor)})`;
}

// The form for a new kiosk, or the name and location of an existing one.
function KioskForm({ kiosk, nodes, onSave, onCancel }) {
  const [name, setName] = useState(kiosk?.name ?? "");
  const [nodeId, setNodeId] = useState(kiosk?.nodeId ?? "");
  const [nodeQuery, setNodeQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ name: name.trim(), nodeId });
    } catch {
      // useKiosks's mutate already reported it.
    } finally {
      setSaving(false);
    }
  };

  const sortedNodes = useMemo(
    () => [...nodes].sort((a, b) => nodeOptionLabel(a).localeCompare(nodeOptionLabel(b))),
    [nodes]
  );
  // The chosen node stays listed even when the search filters it out, so
  // typing never silently changes the selection.
  const visibleNodes = useMemo(
    () => sortedNodes.filter((n) => n.id === nodeId || fuzzyIncludes(nodeQuery, [n.name, n.building, buildingLabel(n.building), floorLabel(n.floor)])),
    [sortedNodes, nodeId, nodeQuery]
  );

  return (
    <form className="signage-card kiosks-form" onSubmit={submit}>
      <label className="signage-setting">
        <span className="signage-field-label">Name</span>
        <input
          type="text"
          className="user-panel-search-input kiosks-form-input"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. GD3 Lobby"
        />
      </label>
      <label className="signage-setting">
        <span className="signage-field-label">Location on the map</span>
        <span className="user-panel-search kiosks-form-search">
          <IconPlaceholder name="search-magnifier" className="user-panel-search-icon" />
          <input
            type="search"
            className="user-panel-search-input"
            placeholder="Search by node name, building or floor"
            aria-label="Search locations on the map"
            value={nodeQuery}
            onChange={(e) => setNodeQuery(e.target.value)}
          />
        </span>
        <select value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
          <option value="">No location yet</option>
          {visibleNodes.map((n) => (
            <option key={n.id} value={n.id}>
              {nodeOptionLabel(n)}
            </option>
          ))}
        </select>
        {nodeQuery.trim() && visibleNodes.length === (nodeId ? 1 : 0) && (
          <span className="signage-field-hint">No locations match this search.</span>
        )}
        <span className="signage-field-hint">Where the kiosk physically stands. "Kiosk Location" directions start here.</span>
      </label>
      <div className="signage-settings-actions">
        <button type="button" className="signage-btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="signage-btn signage-btn--accent" disabled={!name.trim() || saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}

// Kiosks: the physical kiosk devices, each tied to a place on the map. A
// device is paired once, on its own screen (a hidden tap gesture opens the
// pairing screen), by typing the one-time code shown here. An unpaired
// device shows the Mobile web layout, where that gesture lives (see
// utils/kioskPairingGesture.js); pairing reloads it into the kiosk view.
export default function KiosksPage() {
  const { confirm } = useConfirm();
  const { nodes } = useOutletContext();
  const { kiosks, serverTime, loading, error, createKiosk, updateKiosk, resetPairing, deleteKiosk } = useKiosks();
  // null: closed; { kiosk: null }: adding; { kiosk }: editing.
  const [editor, setEditor] = useState(null);
  // The code just generated, shown once: { name, code }.
  const [issued, setIssued] = useState(null);

  const save = async (values) => {
    if (editor.kiosk) {
      await updateKiosk(editor.kiosk, values);
    } else {
      const code = await createKiosk(values);
      setIssued({ name: values.name, code });
    }
    setEditor(null);
  };

  const reset = async (kiosk) => {
    const ok = await confirm({
      title: "Unpair kiosk?",
      message: `Unpair "${kiosk.name}"? The device stops being recognised until it is paired again.`,
      confirmLabel: "Unpair",
      danger: true,
    });
    if (!ok) return;
    try {
      const code = await resetPairing(kiosk);
      setIssued({ name: kiosk.name, code });
    } catch {
      // useKiosks's mutate already reported it.
    }
  };

  const remove = async (kiosk) => {
    const ok = await confirm({
      title: "Delete kiosk?",
      message: `Delete "${kiosk.name}"? This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    deleteKiosk(kiosk).catch(() => {});
  };

  return (
    <div className="signage-page">
      <header className="signage-page-header">
        <div>
          <h2 className="admin-page-heading">Kiosks</h2>
          <p className="signage-page-intro">
            Add a kiosk and choose where it stands on the map, then pair the device using the steps below. A pairing
            code works once and expires after 30 minutes.
          </p>
        </div>
        <button type="button" className="signage-add-btn" onClick={() => setEditor({ kiosk: null })}>
          Add kiosk
        </button>
      </header>

      <section className="signage-card kiosks-steps" aria-label="How to pair a kiosk">
        <div className="signage-card-head">
          <h3>Opening the pairing prompt on the kiosk</h3>
          <span className="signage-card-sub">The prompt is hidden from visitors, so it opens with a tap sequence.</span>
        </div>
        <ol className="kiosks-steps-list">
          <li>
            Open the app on the kiosk device. Until it is paired it shows the phone view: the panorama fills the
            screen, with a menu button on its left edge.
          </li>
          <li>Tap the menu button to open the sidebar, then tap the logo at the top of the sidebar five times.</li>
          <li>
            Close the sidebar (its X button at the top left, or a tap on the panorama), then tap the location name at
            the top of the screen five times.
          </li>
          <li>
            Open the sidebar again and tap the question mark button at its top right once. The pairing prompt then
            appears.
          </li>
          <li>Type the pairing code shown on this page into the prompt. The device reloads into the kiosk view.</li>
        </ol>
        <span className="signage-field-hint">
          Do the steps in this order, starting each within ten seconds of the last. If the prompt does not appear,
          start again from the logo. Use New code on a kiosk below to get a fresh code. To check or unpair a kiosk
          that is already paired, open the prompt on its kiosk view instead: tap the logo five times, the location
          name five times, then the bottom band five times.
        </span>
      </section>

      {error && (
        <div className="error-box" role="alert">
          <p>Couldn't load kiosks: {error}</p>
        </div>
      )}

      {issued && (
        <section className="signage-card kiosks-code" role="status">
          <div className="signage-card-head">
            <h3>Pairing code for {issued.name}</h3>
            <span className="signage-card-sub">Shown once. Type it on the kiosk within 30 minutes.</span>
          </div>
          <p className="kiosks-code-value">{issued.code}</p>
          <div className="signage-settings-actions">
            <button type="button" className="signage-btn" onClick={() => setIssued(null)}>
              Done
            </button>
          </div>
        </section>
      )}

      {editor && <KioskForm kiosk={editor.kiosk} nodes={nodes} onSave={save} onCancel={() => setEditor(null)} />}

      {loading && <p className="empty-hint">Loading...</p>}

      {!loading && kiosks.length === 0 && (
        <div className="signage-empty">
          <p className="signage-empty-title">No kiosks yet</p>
          <p className="signage-field-hint">Add one to get a pairing code for its device.</p>
        </div>
      )}

      {kiosks.length > 0 && (
        <section className="signage-card" aria-label="All kiosks">
          <ol className="signage-list">
            {kiosks.map((kiosk) => {
              const status = kioskStatus(kiosk, serverTime);
              return (
                <li key={kiosk.id} className="signage-row">
                  <div className="signage-row-main">
                    <span className="signage-row-title" title={kiosk.name}>
                      {kiosk.name}
                    </span>
                    <span className="signage-row-meta">
                      {kiosk.nodeName || "No location yet"} · {describeSeen(kiosk)}
                    </span>
                  </div>
                  <span className={`signage-status signage-status--${status.id}`}>{status.label}</span>
                  <div className="signage-row-actions">
                    <button type="button" className="signage-btn" onClick={() => setEditor({ kiosk })}>
                      Edit
                    </button>
                    <button type="button" className="signage-btn" onClick={() => reset(kiosk)}>
                      {kiosk.paired ? "Unpair" : "New code"}
                    </button>
                    <button type="button" className="danger signage-btn" onClick={() => remove(kiosk)}>
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
