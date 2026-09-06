import { useState } from "react";
import { useTourStops } from "../../hooks/useTourStops";
import { useTourSections } from "../../hooks/useTourSections";
import TourStopList from "../../components/TourStopList";
import TourStopForm from "../../components/TourStopForm";
import SectionEditorModal from "../../components/SectionEditorModal";
import DescriptionEditModal from "../../components/DescriptionEditModal";

// Tour Stop equivalent of NodeEditorPage.jsx — genuinely simpler, since
// there's no Building/Floor/Type/Photo Status to filter by, only
// Section, and no Node Flowchart/Node Preview/Export-Import equivalents
// yet. "+ New Section" and "Edit Description" now live here as popup
// triggers, same toolbar position "New Building" occupies next to "New
// Node" on the indoor side — Description Edit and Section Editor used
// to be their own full sidebar pages/routes; both were deleted once
// converted, same discipline the indoor system's own promoted pages
// followed in reverse (RoomEditPanel.jsx etc. deleted once promoted TO
// pages; these deleted once demoted back FROM pages).
//
// Calls useTourStops()/useTourSections() directly rather than via shared
// Outlet context — the Campus Tour sidebar is down to two pages now
// (this one and Campus Tour Navigation Editor), and they still don't
// share state through AdminLayout for the same reason noted there:
// useNodes() and useTourStops() return same-named properties that would
// silently collide if merged into one flat context object.
export default function TourStopsPage() {
  const {
    stops,
    selectedStopId,
    setSelectedStopId,
    addStop,
    updateStop,
    renameStopId,
    deleteStop,
  } = useTourStops();
  const { sections } = useTourSections();

  const [sectionFilter, setSectionFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [descriptionModalOpen, setDescriptionModalOpen] = useState(false);

  const selectedStop = stops.find((s) => s.id === selectedStopId) || null;

  const handleSelect = (id) => {
    setCreating(false);
    setSelectedStopId(id);
  };

  const handleStartCreate = () => {
    setSelectedStopId(null);
    setCreating(true);
  };

  const handleCreateSave = (draft) => {
    addStop(draft);
    setCreating(false);
    setSelectedStopId(draft.id);
  };

  const handleEditSave = (draft, originalId) => {
    if (originalId && draft.id !== originalId) {
      renameStopId(originalId, draft.id);
    }
    updateStop(draft.id, draft);
    setSelectedStopId(draft.id);
  };

  const handleDelete = (id) => {
    if (confirm(`Delete tour stop "${id}"? This also removes it from any connected stop's neighbor list.`)) {
      deleteStop(id);
      setSelectedStopId(null);
    }
  };

  return (
    <div className="node-editor-page">
      <h2 className="admin-page-heading">Tour Stops</h2>

      <div className="node-editor-toolbar">
        <button onClick={handleStartCreate}>+ New Stop</button>
        <button onClick={() => setSectionModalOpen(true)}>+ New Section</button>
        {/* Disabled until a stop is actually selected — this edits
            whichever stop is currently selected in the list, it isn't a
            general/selection-independent action the way New Section is. */}
        <button onClick={() => setDescriptionModalOpen(true)} disabled={!selectedStop}>
          Edit Description
        </button>
      </div>

      <div className="node-editor-body">
        <TourStopList
          stops={stops}
          sections={sections}
          sectionFilter={sectionFilter}
          selectedStopId={selectedStopId}
          onSelect={handleSelect}
        />

        <div className="node-editor-sidebar">
          <div className="panel">
            <h3>Filter</h3>
            <label>
              Section
              <select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
                <option value="all">All</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>{sec.label}</option>
                ))}
              </select>
            </label>
          </div>

          {creating && (
            <TourStopForm
              mode="create"
              stops={stops}
              sections={sections}
              onSave={handleCreateSave}
              onCancel={() => setCreating(false)}
            />
          )}

          {selectedStop && !creating && (
            <TourStopForm
              mode="edit"
              stop={selectedStop}
              stops={stops}
              sections={sections}
              onSave={handleEditSave}
              onCancel={() => setSelectedStopId(null)}
              onDelete={handleDelete}
            />
          )}

          {!selectedStop && !creating && (
            <div className="panel hint-panel">
              <p>Select a tour stop from the list to edit it, or create a new one.</p>
            </div>
          )}
        </div>
      </div>

      {sectionModalOpen && (
        <SectionEditorModal onClose={() => setSectionModalOpen(false)} />
      )}

      {descriptionModalOpen && selectedStop && (
        <DescriptionEditModal
          stop={selectedStop}
          onSave={(id, patch) => updateStop(id, patch)}
          onClose={() => setDescriptionModalOpen(false)}
        />
      )}
    </div>
  );
}
