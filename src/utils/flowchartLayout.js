import dagre from "@dagrejs/dagre";

const NODE_WIDTH = 160;
const NODE_HEIGHT = 130;

// Computes a left-to-right tree layout for the given nodes/edges — dagre
// handles the actual positioning math (avoiding overlaps, arranging
// branches sensibly so the graph's real shape is visible at a glance), we
// just feed it each node's size and get positions back.
export function getLayoutedElements(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 90 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const { x, y } = g.node(node.id);
    // dagre positions by each node's center point; React Flow positions by
    // top-left corner — this recenters it so nodes land where dagre
    // actually intended.
    return { ...node, position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 } };
  });

  return { nodes: layoutedNodes, edges };
}
