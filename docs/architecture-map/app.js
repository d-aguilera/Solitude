const graphEl = document.querySelector("#graph");
const treeEl = document.querySelector("#tree");
const summaryEl = document.querySelector("#summary");
const searchEl = document.querySelector("#search");
const selectionEl = document.querySelector("#selection");
const collapseAllEl = document.querySelector("#collapse-all");
const expandAllEl = document.querySelector("#expand-all");
const expandLevel1El = document.querySelector("#expand-level-1");
const expandLevel2El = document.querySelector("#expand-level-2");
const fitEl = document.querySelector("#fit");

const architecture = await loadArchitecture();
const nodeById = new Map(architecture.nodes.map((node) => [node.id, node]));
const childrenByParent = buildChildren(architecture.nodes);
const packageNodes = architecture.nodes
  .filter((node) => node.kind === "package")
  .sort(compareTreeNodes);
const expanded = new Set();
const selectedEdgeKinds = new Set(
  [...document.querySelectorAll(".filters input:checked")].map(
    (input) => input.value,
  ),
);
const nodeSizes = {
  package: { height: 64, width: 180 },
  module: { height: 58, width: 148 },
  symbol: { height: 46, width: 118 },
};
const gridGap = 34;
const containerPadding = {
  bottom: 34,
  left: 28,
  right: 28,
  top: 58,
};
let selectedNodeId;

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
        "background-color": "#66707b",
        "border-color": "#aeb8c2",
        "border-width": 1,
        color: "#f2f5f7",
        "font-size": 11,
        height: 26,
        label: "data(label)",
        padding: 28,
        "text-background-color": "#151719",
        "text-background-opacity": 0.78,
        "text-background-padding": 3,
        "text-halign": "center",
        "text-margin-y": -8,
        "text-outline-width": 0,
        "text-valign": "top",
        width: 26,
      },
    },
    {
      selector: "node[kind = 'package']",
      style: {
        "background-color": "#54c7a9",
        height: 42,
        padding: 34,
        shape: "round-rectangle",
        width: 72,
      },
    },
    {
      selector: "node[kind = 'module']",
      style: {
        "background-color": "#f1bd5a",
        padding: 28,
        shape: "round-rectangle",
      },
    },
    {
      selector: "node[kind = 'symbol']",
      style: {
        "background-color": "#80a8ff",
        shape: "ellipse",
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
        opacity: 0.68,
        "target-arrow-color": "#66707b",
        "target-arrow-shape": "triangle",
        width: 1.1,
      },
    },
    {
      selector: "edge[kind = 'dependency']",
      style: {
        "line-color": "#54c7a9",
        "target-arrow-color": "#54c7a9",
        width: 2,
      },
    },
    {
      selector: "edge[kind = 'module-import']",
      style: {
        "line-color": "#f1bd5a",
        "target-arrow-color": "#f1bd5a",
      },
    },
    {
      selector: "edge[kind = 'symbol-reference']",
      style: {
        "line-color": "#80a8ff",
        "line-style": "dashed",
        "target-arrow-color": "#80a8ff",
      },
    },
  ],
});

render();

cy.on("tap", "node", (event) => {
  const nodeId = event.target.id();
  selectedNodeId = nodeId;
  if (childrenByParent.has(nodeId)) {
    toggle(nodeId);
  } else {
    renderSelection();
    renderTree();
  }
});

document.querySelectorAll(".filters input").forEach((input) => {
  input.addEventListener("change", () => {
    if (input.checked) {
      selectedEdgeKinds.add(input.value);
    } else {
      selectedEdgeKinds.delete(input.value);
    }
    renderGraph();
  });
});

searchEl.addEventListener("input", render);

collapseAllEl.addEventListener("click", () => {
  expanded.clear();
  selectedNodeId = undefined;
  render();
});

expandLevel1El.addEventListener("click", () => expandToLevel(1));

expandLevel2El.addEventListener("click", () => expandToLevel(2));

expandAllEl.addEventListener("click", expandAll);

fitEl.addEventListener("click", () => {
  cy.fit(undefined, 42);
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

function render() {
  renderTree();
  renderGraph();
  renderSelection();
}

function renderTree() {
  treeEl.replaceChildren(
    ...packageNodes.map((node) => renderTreeNode(node, 0)),
  );
}

function renderTreeNode(node, depth) {
  const fragment = document.createDocumentFragment();
  const row = document.createElement("div");
  const children = childrenByParent.get(node.id) ?? [];
  const hasChildren = children.length > 0;
  const toggleButton = document.createElement("button");
  const labelButton = document.createElement("button");

  row.className = "tree-row";
  row.style.paddingLeft = `${depth * 14}px`;

  toggleButton.className = "tree-toggle";
  toggleButton.type = "button";
  toggleButton.textContent = expanded.has(node.id) ? "-" : "+";
  toggleButton.disabled = !hasChildren;
  toggleButton.addEventListener("click", () => toggle(node.id));

  labelButton.className = `tree-label kind-${node.kind}`;
  if (selectedNodeId === node.id) {
    labelButton.classList.add("is-selected");
  }
  labelButton.type = "button";
  labelButton.title = `${node.label} - ${node.kind}`;
  labelButton.textContent = symbolLabel(node);
  labelButton.addEventListener("click", () => {
    selectedNodeId = node.id;
    renderSelection();
    renderTree();
    const cyNode = cy.getElementById(node.id);
    if (cyNode.nonempty()) {
      cyNode.select();
      cy.center(cyNode);
    }
  });

  row.append(toggleButton, labelButton);
  fragment.append(row);

  if (expanded.has(node.id)) {
    for (const child of children) {
      fragment.append(renderTreeNode(child, depth + 1));
    }
  }

  return fragment;
}

function renderGraph() {
  const visibleNodeIds = getVisibleNodeIds();
  const elements = [];

  for (const nodeId of visibleNodeIds) {
    const node = nodeById.get(nodeId);
    const parent = visibleNodeIds.has(node.parent) ? node.parent : undefined;
    elements.push({
      data: {
        id: node.id,
        kind: node.kind,
        label: symbolLabel(node),
        parent,
      },
    });
  }

  for (const edge of architecture.edges) {
    if (!selectedEdgeKinds.has(edge.kind)) {
      continue;
    }
    if (!visibleNodeIds.has(edge.from) || !visibleNodeIds.has(edge.to)) {
      continue;
    }
    elements.push({
      data: {
        id: edge.id,
        kind: edge.kind,
        source: edge.from,
        target: edge.to,
      },
    });
  }

  cy.elements().remove();
  const positions = calculateGridPositions(visibleNodeIds);

  cy.add(elements);
  cy.layout({
    name: "preset",
    animate: false,
    positions: (node) => positions.get(node.id()) ?? { x: 0, y: 0 },
  }).run();
  cy.fit(undefined, 42);
}

function calculateGridPositions(visibleNodeIds) {
  const layoutByNode = new Map();
  const positions = new Map();
  const packageLayouts = packageNodes
    .filter((node) => visibleNodeIds.has(node.id))
    .map((node) => measureNode(node.id, visibleNodeIds, layoutByNode));
  const rootLayout = packLayouts(packageLayouts);
  const rootX = -rootLayout.width / 2;
  const rootY = -rootLayout.height / 2;

  packageLayouts.forEach((layout, index) => {
    placeLayout(
      layout,
      rootX + rootLayout.cells[index].x,
      rootY + rootLayout.cells[index].y,
      positions,
    );
  });

  return positions;
}

function measureNode(nodeId, visibleNodeIds, layoutByNode) {
  const cached = layoutByNode.get(nodeId);
  if (cached) {
    return cached;
  }

  const node = nodeById.get(nodeId);
  const visibleChildren = (childrenByParent.get(nodeId) ?? [])
    .filter((child) => visibleNodeIds.has(child.id))
    .map((child) => measureNode(child.id, visibleNodeIds, layoutByNode));

  if (visibleChildren.length === 0) {
    const size = nodeSizes[node.kind] ?? nodeSizes.symbol;
    const leafLayout = {
      cells: [],
      children: [],
      height: size.height,
      id: nodeId,
      width: size.width,
    };
    layoutByNode.set(nodeId, leafLayout);
    return leafLayout;
  }

  const childGrid = packLayouts(visibleChildren);
  const layout = {
    cells: childGrid.cells,
    children: visibleChildren,
    height: childGrid.height + containerPadding.top + containerPadding.bottom,
    id: nodeId,
    width: childGrid.width + containerPadding.left + containerPadding.right,
  };
  layoutByNode.set(nodeId, layout);
  return layout;
}

function packLayouts(layouts) {
  if (layouts.length === 0) {
    return { cells: [], height: 0, width: 0 };
  }

  const columns = Math.ceil(Math.sqrt(layouts.length));
  const rows = Math.ceil(layouts.length / columns);
  const columnWidths = Array.from({ length: columns }, () => 0);
  const rowHeights = Array.from({ length: rows }, () => 0);

  layouts.forEach((layout, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    columnWidths[column] = Math.max(columnWidths[column], layout.width);
    rowHeights[row] = Math.max(rowHeights[row], layout.height);
  });

  const columnOffsets = offsetsFor(columnWidths, gridGap);
  const rowOffsets = offsetsFor(rowHeights, gridGap);
  const cells = layouts.map((layout, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      x: columnOffsets[column] + (columnWidths[column] - layout.width) / 2,
      y: rowOffsets[row] + (rowHeights[row] - layout.height) / 2,
    };
  });

  return {
    cells,
    height: sum(rowHeights) + gridGap * (rowHeights.length - 1),
    width: sum(columnWidths) + gridGap * (columnWidths.length - 1),
  };
}

function offsetsFor(lengths, gap) {
  const offsets = [];
  let offset = 0;

  for (const length of lengths) {
    offsets.push(offset);
    offset += length + gap;
  }

  return offsets;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function placeLayout(layout, x, y, positions) {
  positions.set(layout.id, {
    x: x + layout.width / 2,
    y: y + layout.height / 2,
  });

  layout.children.forEach((child, index) => {
    const cell = layout.cells[index];
    placeLayout(
      child,
      x + containerPadding.left + cell.x,
      y + containerPadding.top + cell.y,
      positions,
    );
  });
}

function renderSelection() {
  const node = selectedNodeId ? nodeById.get(selectedNodeId) : undefined;
  if (!node) {
    selectionEl.textContent = "Select a node";
    return;
  }

  const parts = [node.kind, node.packageName, node.symbolKind].filter(Boolean);
  selectionEl.textContent = `${node.label} - ${parts.join(" - ")}`;
}

function getVisibleNodeIds() {
  const visible = new Set(packageNodes.map((node) => node.id));
  const search = searchEl.value.trim().toLowerCase();

  for (const nodeId of [...visible]) {
    addExpandedDescendants(nodeId, visible);
  }

  if (search) {
    for (const node of architecture.nodes) {
      const haystack =
        `${node.label} ${node.kind} ${node.symbolKind ?? ""} ${node.packageName ?? ""}`.toLowerCase();
      if (!haystack.includes(search)) {
        continue;
      }
      addAncestors(node.id, visible);
      visible.add(node.id);
    }
  }

  return visible;
}

function addExpandedDescendants(nodeId, visible) {
  if (!expanded.has(nodeId)) {
    return;
  }

  for (const child of childrenByParent.get(nodeId) ?? []) {
    visible.add(child.id);
    addExpandedDescendants(child.id, visible);
  }
}

function addAncestors(nodeId, visible) {
  let current = nodeById.get(nodeId);
  while (current?.parent) {
    visible.add(current.parent);
    current = nodeById.get(current.parent);
  }
}

function toggle(nodeId) {
  if (expanded.has(nodeId)) {
    expanded.delete(nodeId);
  } else {
    expanded.add(nodeId);
  }
  selectedNodeId = nodeId;
  render();
}

function expandAll() {
  expanded.clear();
  for (const node of architecture.nodes) {
    if (childrenByParent.has(node.id)) {
      expanded.add(node.id);
    }
  }
  render();
}

function expandToLevel(level) {
  expanded.clear();
  for (const node of architecture.nodes) {
    if (!childrenByParent.has(node.id)) {
      continue;
    }
    if (getNodeDepth(node) < level) {
      expanded.add(node.id);
    }
  }
  render();
}

function getNodeDepth(node) {
  let depth = 0;
  let current = node;

  while (current?.parent) {
    depth += 1;
    current = nodeById.get(current.parent);
  }

  return depth;
}

function buildChildren(nodes) {
  const result = new Map();
  for (const node of nodes) {
    if (!node.parent) {
      continue;
    }
    const children = result.get(node.parent) ?? [];
    children.push(node);
    result.set(node.parent, children);
  }

  for (const children of result.values()) {
    children.sort(compareTreeNodes);
  }

  return result;
}

function compareTreeNodes(a, b) {
  return `${kindRank(a.kind)}:${a.label}`.localeCompare(
    `${kindRank(b.kind)}:${b.label}`,
  );
}

function kindRank(kind) {
  return (
    {
      package: 0,
      module: 1,
      symbol: 2,
    }[kind] ?? 9
  );
}

function symbolLabel(node) {
  if (node.kind === "symbol" && node.symbolKind) {
    return `${node.symbolKind} ${node.label}`;
  }
  return node.label;
}
