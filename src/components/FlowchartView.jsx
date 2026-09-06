import { useCallback, useEffect, useState } from "react";
import { ReactFlow, Background, Controls, useNodesInitialized, useNodesState, useReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import PhotoFlowNode from "./PhotoFlowNode";
import { getLayoutedElements } from "../utils/flowchartLayout";
import { allBuildings, buildingLabel, floorsForBuilding, floorLabel } from "../utils/constants";
import { useCustomBuildingsVersion } from "../utils/buildingStore";

const nodeTypes = { photo: PhotoFlowNode };

// fitView as a static prop on <ReactFlow> can fire before the custom
// PhotoFlowNode has actually been measured in the DOM, calculating the
// "fit" against stale/zero dimensions — a known, documented quirk. This
// renders nothing visible; it just waits for useNodesInitialized to
// confirm every node has a real measured size, then calls fitView
// imperatively once that's genuinely true.
function FitViewOnReady() {
  const nodesInitialized = useNodesInitialized();
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (nodesInitialized) fitView({ padding: 0.2 });
  }, [nodesInitialized, fitView]);

  return null;
}

// Builds the node/edge lists for a given scope. dagre computes a baseline
// layout for every node first (so a newly-added or never-manually-moved
// node always gets a reasonable position), then any node with a saved
// flowchartPosition has its position overridden with the saved one
// afterward. Running dagre on the full set, rather than only the
// unpositioned subset, is simpler and avoids dagre needing to account for
// "fixed" nodes mid-layout — the trade-off is dagre's own layout of the
// REST of the graph doesn't know where manually-placed nodes ended up,
// an acceptable trade for how much simpler this keeps things.
function buildFlowElements(inScope) {
  const scopedIds = new Set(inScope.map((n) => n.id));

  const rawNodes = inScope.map((n) => ({
    id: n.id,
    type: "photo",
    data: {
      label: n.name || n.id,
      photo: n.photo,
      nodeId: n.id,
      building: n.building,
      floor: n.floor,
      nodeType: n.type,
      rooms: n.rooms || [],
    },
    position: { x: 0, y: 0 }, // placeholder — getLayoutedElements overwrites this
  }));

  // Neighbor connections are stored bidirectionally (A lists B, and B
  // lists A back) — without deduping, that would produce two separate
  // overlapping edges for every single real connection.
  const seenPairs = new Set();
  const rawEdges = [];
  for (const n of inScope) {
    for (const neighborId of n.neighbors || []) {
      if (!scopedIds.has(neighborId)) continue; // neighbor outside this building/floor — not shown
      const pairKey = [n.id, neighborId].sort().join("::");
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      rawEdges.push({ id: pairKey, source: n.id, target: neighborId });
    }
  }

  const { nodes: laidOutNodes } = getLayoutedElements(rawNodes, rawEdges);

  // Saved positions override dagre's own computed ones, per node.
  const byId = Object.fromEntries(inScope.map((n) => [n.id, n]));
  const finalNodes = laidOutNodes.map((n) => {
    const saved = byId[n.id]?.flowchartPosition;
    return saved ? { ...n, position: { x: saved.x, y: saved.y } } : n;
  });

  return { flowNodes: finalNodes, flowEdges: rawEdges };
}

export default function FlowchartView({ nodes, onUpdateNode, onClose }) {
  const buildings = allBuildings();
  useCustomBuildingsVersion(); // re-render when an admin-created building is added/removed
  const [selectedBuilding, setSelectedBuilding] = useState(buildings[0]?.id || "");
  const [selectedFloor, setSelectedFloor] = useState("all");

  const floorOptions = floorsForBuilding(selectedBuilding);

  // Controlled node/edge state (useNodesState + onNodesChange), not a
  // plain useMemo-computed array — this is what lets React Flow actually
  // track live position updates while a node is being dragged. The
  // previous version passed a fresh array from useMemo directly, which
  // never gave React Flow anywhere to write in-progress drag positions,
  // and got silently overwritten by the next dagre recompute regardless.
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges] = useState([]);

  // Rebuilds ONLY when the scope itself changes (building/floor) — NOT
  // when `nodes` updates for any other reason. This was a real bug:
  // saving a dragged position writes to Firestore, which the admin
  // editor's own listener picks up, producing a brand-new `nodes` array
  // — which, if it were in this effect's dependencies, would re-trigger
  // a full rebuild and reset the viewport on every single drag, right
  // after the position that drag just saved. `nodes` is deliberately
  // read from closure here rather than listed as a dependency — the
  // trade-off is a genuinely unrelated admin change (e.g. someone else
  // adding a node) while the flowchart happens to be open wouldn't
  // appear until the scope is reselected, which is a minor cost next to
  // the viewport resetting on every drag. Live dragging itself is
  // handled entirely by onNodesChange/onNodeDragStop below, without this
  // effect re-running at all.
  useEffect(() => {
    const inScope = nodes.filter(
      (n) =>
        n.building === selectedBuilding &&
        (selectedFloor === "all" || n.floor === selectedFloor)
    );
    const { flowNodes: built, flowEdges: builtEdges } = buildFlowElements(inScope);
    setFlowNodes(built);
    setFlowEdges(builtEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBuilding, selectedFloor]);

  // Persists the final position once a drag actually finishes — not on
  // every intermediate onNodesChange event during the drag itself, which
  // would mean a Firestore write on every single pixel of movement.
  const handleNodeDragStop = useCallback(
    (_event, node) => {
      onUpdateNode?.(node.id, { flowchartPosition: { x: node.position.x, y: node.position.y } });
    },
    [onUpdateNode]
  );

  // Clears every currently-in-scope node's saved position, falling back
  // to dagre's automatic layout again — the escape hatch for when a
  // manual layout gets messy and an admin just wants the clean, computed
  // one back, rather than having to drag everything by hand a second time.
  const handleResetLayout = () => {
    const inScope = nodes.filter(
      (n) =>
        n.building === selectedBuilding &&
        (selectedFloor === "all" || n.floor === selectedFloor)
    );
    const positioned = inScope.filter((n) => n.flowchartPosition);
    if (positioned.length === 0) return;
    if (!confirm(`Reset ${positioned.length} manually-positioned node(s) back to automatic layout?`)) return;
    for (const n of positioned) {
      onUpdateNode?.(n.id, { flowchartPosition: null });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal flowchart-modal" onClick={(e) => e.stopPropagation()}>
        <div className="preview-header">
          <h3>Flowchart</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="flowchart-controls">
          <label>
            Building
            <select
              value={selectedBuilding}
              onChange={(e) => {
                setSelectedBuilding(e.target.value);
                setSelectedFloor("all");
              }}
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{buildingLabel(b.id)}</option>
              ))}
            </select>
          </label>

          <label>
            Floor
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value === "all" ? "all" : Number(e.target.value))}
            >
              <option value="all">All floors</option>
              {floorOptions.map((f) => (
                <option key={f} value={f}>{floorLabel(f)}</option>
              ))}
            </select>
          </label>

          {onUpdateNode && flowNodes.length > 0 && (
            <button type="button" className="flowchart-reset-btn" onClick={handleResetLayout}>
              ↺ Reset layout
            </button>
          )}

          {flowNodes.length === 0 && (
            <span className="field-hint">No nodes found for this selection.</span>
          )}
        </div>

        <div className="flowchart-canvas">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onNodeDragStop={handleNodeDragStop}
          >
            <FitViewOnReady />
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
