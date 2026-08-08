const graphEl = document.querySelector("#graph");
const summaryEl = document.querySelector("#summary");
const fitEl = document.querySelector("#fit");
const layoutEl = document.querySelector("#layout");

const architecture = await loadArchitecture();
const packageNodes = architecture.nodes.filter(
  (node) => node.kind === "package",
);
const nodeSize = { height: 64, width: 180 };
const layoutStorageKey = "solitude.architectureMap.layout.v1";
const layoutSignature = createLayoutSignature();
let selectedNodeId;
let positionsByNodeId = await loadStoredPositions();
if (!positionsByNodeId) {
  positionsByNodeId = await calculateElkPositions();
  storePositions();
}

summaryEl.textContent = `${architecture.nodes.length} nodes, ${architecture.edges.length} edges. Generated ${new Date(
  architecture.generatedAt,
).toLocaleString()}.`;

const cy = cytoscape({
  container: graphEl,
  elements: [],
  layout: { name: "cose", animate: false },
  maxZoom: 2.6,
  minZoom: 0.08,
  style: [
    {
      selector: "node",
      style: {
        "background-opacity": 0,
        "border-color": "#54c7a9",
        "border-width": 2,
        color: "#f2f5f7",
        "font-size": 14,
        height: 21,
        label: "data(label)",
        padding: 34,
        shape: "round-rectangle",
        "text-background-color": "#151719",
        "text-background-opacity": 0,
        "text-background-padding": 0,
        "text-halign": "center",
        "text-max-width": 126,
        "text-outline-width": 0,
        "text-overflow-wrap": "anywhere",
        "text-valign": "center",
        "text-wrap": "wrap",
        width: 98,
      },
    },
    {
      selector: "node:selected",
      style: {
        "border-color": "#ffffff",
        "border-width": 3,
      },
    },
    {
      selector: "edge",
      style: {
        "curve-style": "bezier",
        "line-color": "#66707b",
        label: "data(label)",
        opacity: 0.68,
        "target-arrow-color": "#66707b",
        "target-arrow-shape": "triangle",
        "text-background-color": "#151719",
        "text-background-opacity": 0.78,
        "text-background-padding": 2,
        "text-rotation": "autorotate",
        width: 1.1,
      },
    },
    {
      selector: "edge[kind = 'dependency']",
      style: {
        "line-color": "#aeb8c2",
        "target-arrow-color": "#aeb8c2",
        width: 2,
      },
    },
  ],
});

renderGraph();
cy.fit(undefined, 42);

cy.on("tap", "node", (event) => {
  const nodeId = event.target.id();
  selectedNodeId = nodeId;
});

fitEl.addEventListener("click", () => {
  cy.fit(undefined, 42);
});

layoutEl.addEventListener("click", async () => {
  layoutEl.disabled = true;
  layoutEl.textContent = "Layout...";
  positionsByNodeId = await calculateElkPositions();
  storePositions();
  renderGraph();
  cy.fit(undefined, 42);
  layoutEl.textContent = "Layout";
  layoutEl.disabled = false;
});

cy.on("dragfree", "node", () => {
  syncPositionsFromGraph();
  storePositions();
});

async function loadArchitecture() {
  try {
    const response = await fetch("./architecture.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    graphEl.textContent =
      "Could not load architecture.json. Serve docs/architecture-map over HTTP after running npm run map:architecture.";
    throw error;
  }
}

function renderGraph() {
  const elements = [];

  for (const node of packageNodes) {
    elements.push({
      data: {
        id: node.id,
        kind: node.kind,
        label: node.label.split("/").join("\n\n"),
      },
      position: positionsByNodeId.get(node.id),
    });
  }

  for (const edge of projectEdges()) {
    elements.push({
      data: {
        id: edge.id,
        kind: edge.kind,
        label: edge.count > 1 ? String(edge.count) : "",
        source: edge.from,
        target: edge.to,
      },
    });
  }

  cy.elements().remove();
  cy.add(elements);

  if (selectedNodeId) {
    cy.getElementById(selectedNodeId).select();
  }
}

async function loadStoredPositions() {
  try {
    const raw = localStorage.getItem(layoutStorageKey);
    if (!raw) {
      return undefined;
    }

    const stored = JSON.parse(raw);
    if (stored.signature !== layoutSignature || !stored.positions) {
      return undefined;
    }

    const positions = new Map();
    for (const node of architecture.nodes) {
      const position = stored.positions[node.id];
      if (
        !position ||
        !Number.isFinite(position.x) ||
        !Number.isFinite(position.y)
      ) {
        return undefined;
      }
      positions.set(node.id, position);
    }
    return positions;
  } catch (error) {
    console.warn("Could not load stored architecture layout.", error);
    return undefined;
  }
}

function storePositions() {
  try {
    localStorage.setItem(
      layoutStorageKey,
      JSON.stringify({
        positions: Object.fromEntries(positionsByNodeId),
        signature: layoutSignature,
      }),
    );
  } catch (error) {
    console.warn("Could not store architecture layout.", error);
  }
}

function syncPositionsFromGraph() {
  for (const node of cy.nodes()) {
    positionsByNodeId.set(node.id(), node.position());
  }
}

function createLayoutSignature() {
  const nodeIds = architecture.nodes
    .map((node) => node.id)
    .sort()
    .join("|");
  const edgeIds = architecture.edges
    .map((edge) => edge.id)
    .sort()
    .join("|");
  return `${architecture.nodes.length}:${architecture.edges.length}:${hashString(
    `${nodeIds}\n${edgeIds}`,
  )}`;
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return String(hash);
}

function projectEdges() {
  const projected = new Map();
  for (const edge of architecture.edges) {
    const from = edge.from;
    const to = edge.to;

    if (!from || !to || from === to) {
      continue;
    }

    const id = `projected:${from}->${to}`;
    const existing = projected.get(id);
    if (existing) {
      existing.count += 1;
      continue;
    }

    projected.set(id, {
      count: 1,
      from,
      id,
      kind: "dependency",
      to,
    });
  }
  return [...projected.values()];
}

async function calculateElkPositions() {
  if (typeof globalThis.ELK !== "function") {
    throw new Error("ELK is not available.");
  }

  const layoutOptions = {
    "elk.algorithm": "layered",
    "elk.direction": "RIGHT",
    "elk.edgeRouting": "ORTHOGONAL",
    "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    "elk.spacing.edgeEdge": "18",
    "elk.spacing.edgeNode": "42",
    "elk.spacing.nodeNode": "52",
  };

  const children = architecture.nodes.map((node) => {
    return {
      height: nodeSize.height,
      id: node.id,
      width: nodeSize.width,
    };
  });

  const edges = architecture.edges.map((edge) => ({
    id: edge.id,
    sources: [edge.from],
    targets: [edge.to],
  }));

  const elk = new globalThis.ELK();
  const elkGraph = {
    id: "root",
    layoutOptions,
    children,
    edges,
  };
  const layout = await elk.layout(elkGraph);
  const positions = new Map();

  for (const child of layout.children) {
    positions.set(child.id, {
      x: child.x + nodeSize.width / 2,
      y: child.y + nodeSize.height / 2,
    });
  }

  centerPositions(positions);
  return positions;
}

function centerPositions(positions) {
  const values = [...positions.values()];
  if (values.length === 0) {
    return;
  }

  const minX = Math.min(...values.map((position) => position.x));
  const maxX = Math.max(...values.map((position) => position.x));
  const minY = Math.min(...values.map((position) => position.y));
  const maxY = Math.max(...values.map((position) => position.y));
  const offsetX = (minX + maxX) / 2;
  const offsetY = (minY + maxY) / 2;

  for (const [id, position] of positions) {
    positions.set(id, {
      x: position.x - offsetX,
      y: position.y - offsetY,
    });
  }
}
