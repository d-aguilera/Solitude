const graphEl = document.querySelector("#graph");
const summaryEl = document.querySelector("#summary");
const fitEl = document.querySelector("#fit");
const layoutEl = document.querySelector("#layout");

const architecture = await loadArchitecture();
const packageNodes = architecture.nodes.filter(
  (node) => node.kind === "package",
);
const nodeSize = { height: 64, width: 180 };
const constraintNodeSize = { height: 92, width: 180 };
const constraintMargin = 24;
const dragProjectionRadii = [8, 16, 32, 56, 88, 128, 184, 256, 352];
const dragProjectionAngleCount = 24;
const layoutStorageKey = "solitude.architectureMap.layout.v1";
const layoutSignature = createLayoutSignature();
let selectedNodeIds = new Set();
let dragState;
let positionsByNodeId = await loadStoredPositions();
if (!positionsByNodeId) {
  positionsByNodeId = await calculateElkPositions();
  storePositions();
}

summaryEl.textContent = `${architecture.nodes.length} nodes, ${architecture.edges.length} edges. Generated ${new Date(
  architecture.generatedAt,
).toLocaleString()}.`;

const cy = cytoscape({
  autoungrabify: true,
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
        "font-size": 16,
        height: 21,
        label: "data(label)",
        padding: 34,
        shape: "round-rectangle",
        "text-background-color": "#151719",
        "text-background-opacity": 0,
        "text-background-padding": 0,
        "text-halign": "center",
        "text-max-width": 140,
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
        "background-opacity": 0.2,
      },
    },
    {
      selector: "node.invalid-layout",
      style: {
        "border-color": "#ff7b7b",
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
updateConstraintViolations();

cy.on("select unselect", "node", () => {
  selectedNodeIds = new Set(cy.nodes(":selected").map((node) => node.id()));
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
  updateConstraintViolations();
  layoutEl.textContent = "Layout";
  layoutEl.disabled = false;
});

graphEl.addEventListener("pointerdown", handleGraphPointerDown, {
  capture: true,
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

  for (const selectedNodeId of selectedNodeIds) {
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
      positions.set(node.id, roundPosition(position));
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
    positionsByNodeId.set(node.id(), roundPosition(node.position()));
  }
}

function readGraphPositions() {
  const positions = new Map();
  for (const node of cy.nodes()) {
    positions.set(node.id(), roundPosition(node.position()));
  }
  return positions;
}

function handleGraphPointerDown(event) {
  if (event.button !== 0) {
    return;
  }

  const grabbedNode = findNodeAtRenderedPosition(event.clientX, event.clientY);
  if (!grabbedNode) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const startGraphPosition = renderedToGraphPosition(
    event.clientX,
    event.clientY,
  );
  const positions = readGraphPositions();
  const movedNodeIds = getMovedNodeIds(grabbedNode);
  const evaluation = evaluateLayoutConstraints(positions);
  dragState = {
    grabbedNodeId: grabbedNode.id(),
    isDragging: false,
    lastAcceptedDelta: { x: 0, y: 0 },
    lastAcceptedPenalty: evaluation.penalty,
    lastAcceptedPositions: positions,
    lastAcceptedScore: evaluation.score,
    movedNodeIds,
    pointerId: event.pointerId,
    selectionMode:
      event.shiftKey || event.ctrlKey || event.metaKey ? "toggle" : "replace",
    startGraphPosition,
    startingMovedViolationKeys: getMovedViolationKeys(
      evaluation.violations,
      movedNodeIds,
    ),
    startPositions: copyPositions(positions),
  };

  graphEl.setPointerCapture(event.pointerId);
  graphEl.addEventListener("pointermove", handleGraphPointerMove);
  graphEl.addEventListener("pointerup", handleGraphPointerUp);
  graphEl.addEventListener("pointercancel", handleGraphPointerUp);
}

function handleGraphPointerMove(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const graphPosition = renderedToGraphPosition(event.clientX, event.clientY);
  const delta = {
    x: graphPosition.x - dragState.startGraphPosition.x,
    y: graphPosition.y - dragState.startGraphPosition.y,
  };

  if (!dragState.isDragging && Math.hypot(delta.x, delta.y) < 2) {
    return;
  }

  dragState.isDragging = true;

  const candidatePositions = createTranslatedPositions(
    dragState.startPositions,
    dragState.movedNodeIds,
    delta,
  );
  const evaluation = evaluateLayoutConstraints(candidatePositions);
  if (isAllowedDragEvaluation(evaluation, dragState)) {
    acceptDragPositions(delta, candidatePositions, evaluation);
    return;
  }

  const projected = findClosestAllowedDragProjection(dragState, delta);
  if (!projected) {
    applyPositions(dragState.lastAcceptedPositions, dragState.movedNodeIds);
    updateConstraintViolations(
      findConstraintViolations(dragState.lastAcceptedPositions),
    );
    return;
  }

  acceptDragPositions(
    projected.delta,
    projected.positions,
    projected.evaluation,
  );
}

function handleGraphPointerUp(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  graphEl.releasePointerCapture(event.pointerId);
  graphEl.removeEventListener("pointermove", handleGraphPointerMove);
  graphEl.removeEventListener("pointerup", handleGraphPointerUp);
  graphEl.removeEventListener("pointercancel", handleGraphPointerUp);

  if (dragState.isDragging) {
    syncPositionsFromGraph();
    storePositions();
    updateConstraintViolations();
  } else {
    selectClickedNode(dragState.grabbedNodeId, dragState.selectionMode);
  }
  dragState = undefined;
}

function selectClickedNode(nodeId, selectionMode) {
  const node = cy.getElementById(nodeId);
  if (selectionMode === "toggle") {
    if (node.selected()) {
      node.unselect();
    } else {
      node.select();
    }
    return;
  }

  cy.nodes(":selected").unselect();
  node.select();
}

function getMovedNodeIds(grabbedNode) {
  const selected = cy.nodes(":selected");
  if (grabbedNode.selected() && selected.length > 0) {
    return selected.map((node) => node.id());
  }
  return [grabbedNode.id()];
}

function findNodeAtRenderedPosition(clientX, clientY) {
  const graphPosition = renderedToGraphPosition(clientX, clientY);
  const nodes = cy.nodes();
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    const box = createNodeBox(node.position(), 0);
    if (pointInBox(graphPosition, box)) {
      return node;
    }
  }
  return undefined;
}

function renderedToGraphPosition(clientX, clientY) {
  const rect = graphEl.getBoundingClientRect();
  const pan = cy.pan();
  const zoom = cy.zoom();
  return {
    x: (clientX - rect.left - pan.x) / zoom,
    y: (clientY - rect.top - pan.y) / zoom,
  };
}

function createTranslatedPositions(startPositions, movedNodeIds, delta) {
  const positions = copyPositions(startPositions);
  for (const nodeId of movedNodeIds) {
    const startPosition = startPositions.get(nodeId);
    if (startPosition) {
      positions.set(nodeId, {
        x: Math.round(startPosition.x + delta.x),
        y: Math.round(startPosition.y + delta.y),
      });
    }
  }
  return positions;
}

function acceptDragPositions(delta, positions, evaluation) {
  dragState.lastAcceptedDelta = delta;
  dragState.lastAcceptedPositions = positions;
  dragState.lastAcceptedPenalty = evaluation.penalty;
  dragState.lastAcceptedScore = evaluation.score;
  applyPositions(positions, dragState.movedNodeIds);
  updateConstraintViolations(evaluation.invalidNodeIds);
}

function findClosestAllowedDragProjection(state, desiredDelta) {
  let bestProjection;

  const considerDelta = (delta) => {
    const positions = createTranslatedPositions(
      state.startPositions,
      state.movedNodeIds,
      delta,
    );
    const evaluation = evaluateLayoutConstraints(positions);
    if (!isAllowedDragEvaluation(evaluation, state)) {
      return;
    }

    const cursorDistance = calculateSquaredDistance(delta, desiredDelta);
    const continuityDistance = calculateSquaredDistance(
      delta,
      state.lastAcceptedDelta,
    );
    if (
      !bestProjection ||
      cursorDistance < bestProjection.cursorDistance ||
      (cursorDistance === bestProjection.cursorDistance &&
        continuityDistance < bestProjection.continuityDistance)
    ) {
      bestProjection = {
        continuityDistance,
        cursorDistance,
        delta,
        evaluation,
        positions,
      };
    }
  };

  const considerBoundary = (targetDelta) => {
    const boundaryDelta = findAllowedBoundaryDelta(
      state,
      state.lastAcceptedDelta,
      targetDelta,
    );
    considerDelta(boundaryDelta);
  };

  considerDelta(state.lastAcceptedDelta);

  const horizontalSlideDelta = {
    x: desiredDelta.x,
    y: state.lastAcceptedDelta.y,
  };
  const verticalSlideDelta = {
    x: state.lastAcceptedDelta.x,
    y: desiredDelta.y,
  };
  considerDelta(horizontalSlideDelta);
  considerDelta(verticalSlideDelta);
  considerBoundary(desiredDelta);
  considerBoundary(horizontalSlideDelta);
  considerBoundary(verticalSlideDelta);

  for (const radius of dragProjectionRadii) {
    considerDelta({ x: desiredDelta.x - radius, y: desiredDelta.y });
    considerDelta({ x: desiredDelta.x + radius, y: desiredDelta.y });
    considerDelta({ x: desiredDelta.x, y: desiredDelta.y - radius });
    considerDelta({ x: desiredDelta.x, y: desiredDelta.y + radius });

    for (let index = 0; index < dragProjectionAngleCount; index += 1) {
      const angle = (Math.PI * 2 * index) / dragProjectionAngleCount;
      considerDelta({
        x: desiredDelta.x + Math.cos(angle) * radius,
        y: desiredDelta.y + Math.sin(angle) * radius,
      });
    }
  }

  return bestProjection;
}

function findAllowedBoundaryDelta(state, fromDelta, toDelta) {
  let lower = fromDelta;
  let upper = toDelta;

  for (let index = 0; index < 12; index += 1) {
    const midpoint = {
      x: (lower.x + upper.x) / 2,
      y: (lower.y + upper.y) / 2,
    };
    const positions = createTranslatedPositions(
      state.startPositions,
      state.movedNodeIds,
      midpoint,
    );
    const evaluation = evaluateLayoutConstraints(positions);
    if (isAllowedDragEvaluation(evaluation, state)) {
      lower = midpoint;
    } else {
      upper = midpoint;
    }
  }

  return lower;
}

function calculateSquaredDistance(left, right) {
  const deltaX = left.x - right.x;
  const deltaY = left.y - right.y;
  return deltaX * deltaX + deltaY * deltaY;
}

function applyPositions(positions, nodeIds) {
  for (const nodeId of nodeIds) {
    const position = positions.get(nodeId);
    if (position) {
      cy.getElementById(nodeId).position(roundPosition(position));
    }
  }
}

function copyPositions(positions) {
  const copy = new Map();
  for (const [nodeId, position] of positions) {
    copy.set(nodeId, roundPosition(position));
  }
  return copy;
}

function roundPosition(position) {
  return {
    x: Math.round(position.x),
    y: Math.round(position.y),
  };
}

function updateConstraintViolations(
  invalidNodeIds = findConstraintViolations(readGraphPositions()),
) {
  cy.nodes().removeClass("invalid-layout");
  for (const nodeId of invalidNodeIds) {
    cy.getElementById(nodeId).addClass("invalid-layout");
  }
}

function findConstraintViolations(positions) {
  return evaluateLayoutConstraints(positions).invalidNodeIds;
}

function evaluateLayoutConstraints(positions) {
  const invalidNodeIds = new Set();
  const boxes = new Map();
  const violations = [];
  let penalty = 0;

  for (const node of packageNodes) {
    const position = positions.get(node.id);
    if (!position) {
      addViolation(
        violations,
        invalidNodeIds,
        `missing:${node.id}`,
        [node.id],
        1,
      );
      continue;
    }
    boxes.set(node.id, createNodeBox(position, constraintMargin));
  }

  const nodeIds = [...boxes.keys()];
  for (let leftIndex = 0; leftIndex < nodeIds.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < nodeIds.length;
      rightIndex += 1
    ) {
      const leftId = nodeIds[leftIndex];
      const rightId = nodeIds[rightIndex];
      const overlap = calculateBoxOverlap(
        boxes.get(leftId),
        boxes.get(rightId),
      );
      if (overlap > 0) {
        addViolation(
          violations,
          invalidNodeIds,
          `overlap:${leftId}<->${rightId}`,
          [leftId, rightId],
          overlap,
        );
      }
    }
  }

  for (const edge of projectEdges()) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) {
      addViolation(
        violations,
        invalidNodeIds,
        `edge-missing:${edge.id}`,
        [edge.from, edge.to],
        1,
      );
      continue;
    }

    if (to.y < from.y) {
      addViolation(
        violations,
        invalidNodeIds,
        `upward-edge:${edge.id}`,
        [edge.from, edge.to],
        from.y - to.y,
      );
    }

    for (const [nodeId, box] of boxes) {
      if (nodeId === edge.from || nodeId === edge.to) {
        continue;
      }
      if (segmentIntersectsBox(from, to, box)) {
        addViolation(
          violations,
          invalidNodeIds,
          `edge-crosses-box:${edge.id}:${nodeId}`,
          [edge.from, edge.to, nodeId],
          1,
        );
      }
    }
  }

  for (const violation of violations) {
    penalty += violation.penalty;
  }

  return { invalidNodeIds, penalty, score: violations.length, violations };
}

function isAllowedDragEvaluation(evaluation, state) {
  if (
    evaluation.score > state.lastAcceptedScore ||
    (evaluation.score === state.lastAcceptedScore &&
      evaluation.penalty > state.lastAcceptedPenalty)
  ) {
    return false;
  }

  const movedViolationKeys = getMovedViolationKeys(
    evaluation.violations,
    state.movedNodeIds,
  );
  for (const violationKey of movedViolationKeys) {
    if (!state.startingMovedViolationKeys.has(violationKey)) {
      return false;
    }
  }
  return true;
}

function getMovedViolationKeys(violations, movedNodeIds) {
  const movedNodeIdSet = new Set(movedNodeIds);
  const keys = new Set();
  for (const violation of violations) {
    if (violation.nodeIds.some((nodeId) => movedNodeIdSet.has(nodeId))) {
      keys.add(violation.key);
    }
  }
  return keys;
}

function addViolation(violations, invalidNodeIds, key, nodeIds, penalty) {
  violations.push({ key, nodeIds, penalty });
  for (const nodeId of nodeIds) {
    invalidNodeIds.add(nodeId);
  }
}

function createNodeBox(position, margin) {
  return {
    bottom: position.y + constraintNodeSize.height / 2 + margin,
    left: position.x - constraintNodeSize.width / 2 - margin,
    right: position.x + constraintNodeSize.width / 2 + margin,
    top: position.y - constraintNodeSize.height / 2 - margin,
  };
}

function calculateBoxOverlap(left, right) {
  const horizontalOverlap =
    Math.min(left.right, right.right) - Math.max(left.left, right.left);
  const verticalOverlap =
    Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top);
  if (horizontalOverlap <= 0 || verticalOverlap <= 0) {
    return 0;
  }
  return Math.min(horizontalOverlap, verticalOverlap);
}

function segmentIntersectsBox(start, end, box) {
  if (pointInBox(start, box) || pointInBox(end, box)) {
    return true;
  }

  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  let near = 0;
  let far = 1;

  for (const [axisDelta, lowerDistance, upperDistance] of [
    [deltaX, start.x - box.left, box.right - start.x],
    [deltaY, start.y - box.top, box.bottom - start.y],
  ]) {
    if (axisDelta === 0) {
      if (lowerDistance < 0 || upperDistance < 0) {
        return false;
      }
      continue;
    }

    const axisNear = -lowerDistance / axisDelta;
    const axisFar = upperDistance / axisDelta;
    near = Math.max(near, Math.min(axisNear, axisFar));
    far = Math.min(far, Math.max(axisNear, axisFar));
    if (near > far) {
      return false;
    }
  }

  return true;
}

function pointInBox(point, box) {
  return (
    point.x >= box.left &&
    point.x <= box.right &&
    point.y >= box.top &&
    point.y <= box.bottom
  );
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
    positions.set(
      id,
      roundPosition({
        x: position.x - offsetX,
        y: position.y - offsetY,
      }),
    );
  }
}
