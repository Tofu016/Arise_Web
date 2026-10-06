import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import NodeList from "../../components/NodeList";
import FilterPanel from "../../components/FilterPanel";
import NodeForm from "../../components/NodeForm";
import ExportImportBar from "../../components/ExportImportBar";
import PreviewTour from "../../components/PreviewTour";
import AddBuildingDialog from "../../components/AddBuildingDialog";
import { useConfirm } from "../../context/useConfirm";

const defaultFilters = {
  building: "all",
  floor: "all",
  type: "all",
  photoStatus: "all",
  search: "",
};

// Toolbar (New Node/New Building/Node Preview) is deliberately
// scoped to this page only, not shared across every admin section —
// confirmed against the wireframes, where neither Virtual Map Navigation
// Editor nor Room Editor show it. The flowchart moved out to its own
// Node Flowchart sidebar destination, so it's no longer part of this
// toolbar at all.
//
// Neighbor-linking is no longer edited here at all — NodeForm had its
// NeighborPicker removed; Navigation Editor is now the sole
// place that's managed, per the redesign.
export default function NodeEditorPage() {
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const {
    nodes,
    selectedNodeId,
    setSelectedNodeId,
    addNode,
    updateNode,
    renameNodeId,
    moveNodesToBuilding,
    deleteNode,
  } = useOutletContext();

  const [filters, setFilters] = useState(defaultFilters);
  const [creating, setCreating] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [addBuildingOpen, setAddBuildingOpen] = useState(false);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  // Blinks the form's edge red. Only a deliberate create -> edit swap (or
  // pressing New Node) counts; hopping between nodes in the list must not.
  // `n` re-keys the overlay so the animation restarts on every trigger.
  const [flash, setFlash] = useState({ kind: null, n: 0 });
  const triggerFlash = (kind) => setFlash((f) => ({ kind, n: f.n + 1 }));

  const handleSelect = (id) => {
    if (creating) triggerFlash("edit");
    setCreating(false);
    setSelectedNodeId(id);
  };

  const handleStartCreate = () => {
    setSelectedNodeId(null);
    setCreating(true);
    triggerFlash("create");
  };

  const handleCreateSave = (draft) => {
    addNode(draft);
    setCreating(false);
    setSelectedNodeId(draft.id);
  };

  const handleEditSave = (draft, originalId) => {
    if (originalId && draft.id !== originalId) {
      renameNodeId(originalId, draft.id);
    }
    updateNode(draft.id, draft);
    setSelectedNodeId(draft.id);
  };

  const openInNavigationEditor = (id) => {
    setSelectedNodeId(id);
    navigate("/admin/navigation-editor");
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: "Delete node?",
      message: `Delete node "${id}"? This also removes it from any connected node's neighbor list.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (ok) {
      deleteNode(id);
      setSelectedNodeId(null);
    }
  };

  // Jump the filter straight to the new building once created. If a building
  // was deleted instead and it happened to be the one currently filtered on,
  // fall back to "all" so the filter panel doesn't get stuck on a building
  // that no longer exists.
  const handleAddBuildingClose = (result) => {
    setAddBuildingOpen(false);
    if (result?.id) {
      setFilters((f) => ({ ...f, building: result.id, floor: "all" }));
    } else if (result?.deletedId) {
      setFilters((f) =>
        f.building === result.deletedId ? { ...f, building: "all", floor: "all" } : f
      );
    }
  };

  return (
    <div className="node-editor-page node-editor-page-split">
      <h2 className="admin-page-heading">Node Editor</h2>

      <div className="node-editor-toolbar">
        <button onClick={handleStartCreate}>+ New Node</button>
        <button className="admin-btn-secondary" onClick={() => setAddBuildingOpen(true)}>+ New Building</button>
        <button className="admin-btn-secondary" onClick={() => setPreviewOpen(true)}>Node Preview</button>

        {/* Not shown in the wireframes at all — kept here rather than
            silently dropped, since downloading a backup of the node data is
            real, working functionality, not something to lose in a
            layout-only pass. Flag if this should live somewhere else
            instead. */}
        <ExportImportBar nodes={nodes} />
      </div>

      <div className="node-editor-body">
        <div className="node-editor-sidebar node-editor-form-column">
          {creating && (
            <div className="node-form-flash-frame">
              <NodeForm
                mode="create"
                nodes={nodes}
                onSave={handleCreateSave}
                onCancel={() => setCreating(false)}
                onAddMarkers={openInNavigationEditor}
              />
              {flash.kind === "create" && <span key={flash.n} className="node-form-flash" aria-hidden="true" />}
            </div>
          )}

          {selectedNode && !creating && (
            <div className="node-form-flash-frame">
              <NodeForm
                mode="edit"
                node={selectedNode}
                nodes={nodes}
                onSave={handleEditSave}
                onCancel={() => setSelectedNodeId(null)}
                onDelete={handleDelete}
                onAddMarkers={openInNavigationEditor}
              />
              {flash.kind === "edit" && <span key={flash.n} className="node-form-flash" aria-hidden="true" />}
            </div>
          )}

          {!selectedNode && !creating && (
            <div className="panel hint-panel">
              <p>Select a node from the list to edit it, or create a new one.</p>
            </div>
          )}
        </div>

        <div className="node-editor-list-column">
          <FilterPanel filters={filters} onChange={setFilters} />
          <NodeList
            nodes={nodes}
            filters={filters}
            selectedNodeId={selectedNodeId}
            onSelect={handleSelect}
          />
        </div>
      </div>

      {previewOpen && (
        <PreviewTour nodes={nodes} startNodeId={selectedNodeId} onClose={() => setPreviewOpen(false)} />
      )}

      {addBuildingOpen && <AddBuildingDialog nodes={nodes} onMoveNodes={moveNodesToBuilding} onClose={handleAddBuildingClose} />}
    </div>
  );
}
