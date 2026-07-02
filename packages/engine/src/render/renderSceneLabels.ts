import type { SceneLabelCandidate } from "../app/pluginPorts";
import type { ViewLabelMode } from "../app/viewPorts";
import type { Vec3 } from "../domain/vec3";
import { alloc } from "../global/allocProfiler";
import { LABEL_FONT } from "./labelStyle";
import { type NdcPoint, ndc } from "./ndc";
import type {
  Point,
  RenderedSceneLabel,
  Size,
  TextMetrics,
} from "./renderPorts";
import { scrn } from "./scrn";
import { sortRangeInPlace } from "./sortRange";

type SortedScratchItem = {
  label: SceneLabelCandidate;
};

const sortedScratch: SortedScratchItem[] = [];
const ndcScratch: NdcPoint = ndc.zero();
const parentNdcScratch: NdcPoint = ndc.zero();

export interface LabelLayoutCache {
  font: string;
  charWidth: number;
  labelMode: ViewLabelMode;
  lastLayoutTimeMs: number;
  lastScreenWidth: number;
  lastScreenHeight: number;
  lastLabelCount: number;
  needsRelayout: boolean;
  sortedLabels: SceneLabelCandidate[];
  entries: Map<string, LabelLayoutEntry>;
  labelById: Map<string, SceneLabelCandidate>;
  grid: LabelSpatialGrid;
}

interface LabelLayoutEntry {
  directionIndex: number;
  size: Size;
}

interface LabelSpatialGrid {
  cellSize: number;
  cells: Map<string, LabelGridCell>;
}

interface LabelGridCell {
  labels: number[];
  centers: number[];
}

const LABEL_LAYOUT_INTERVAL_MS = 150;
const LABEL_GRID_CELL_SIZE = 128;

export function createLabelLayoutCache(
  measureText: (text: string, font: string) => TextMetrics,
  font: string = LABEL_FONT,
): LabelLayoutCache {
  const metrics = measureText("M", font);
  const charWidth = metrics.width || 8;
  return {
    font,
    charWidth,
    labelMode: "full",
    lastLayoutTimeMs: -Infinity,
    lastScreenWidth: -1,
    lastScreenHeight: -1,
    lastLabelCount: -1,
    needsRelayout: true,
    sortedLabels: [],
    entries: new Map(),
    labelById: new Map(),
    grid: {
      cellSize: LABEL_GRID_CELL_SIZE,
      cells: new Map(),
    },
  };
}

/**
 * Scratch structure for tracking placed label rectangles across a single render pass.
 */
interface LabelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const placedLabelRectsScratch: LabelRect[] = [];
let placedLabelCount = 0;

/**
 * Scratch structure for tracking all projected anchors that are in front of
 * the camera and on-screen during a single render pass.
 */
let allAnchorsCount = 0;
const allAnchorsScratch: Point[] = [];
const anchor = scrn.zero();
const parentAnchor = scrn.zero();
const boxCenter: Point = { x: 0, y: 0 };
const boxSize: Size = { width: 0, height: 0 };
const candidate: Point = { x: 0, y: 0 };
const center: Point = { x: 0, y: 0 };
const edgePoint: Point = { x: 0, y: 0 };
const lines = ["", "", ""];
const position: Point = { x: 0, y: 0 };

// Label style
const angleStep = 45;
const angleStepRad = (angleStep * Math.PI) / 180;
const lineHeight = 16;
const padding: Size = { width: 6, height: 4 };

/**
 * Render scene labels with a cached layout:
 *  - Fast path every frame: project anchors, use cached placement direction,
 *    and render labels.
 *  - Slow path on a throttled interval: recompute layout by probing 8 angles
 *    at 45° steps (starting from 45°) while avoiding overlaps and visible
 *    label anchors using a spatial grid.
 */
export function renderSceneLabelsInto(
  into: RenderedSceneLabel[],
  labels: SceneLabelCandidate[],
  labelCount: number,
  screenWidth: number,
  screenHeight: number,
  projectInto: (into: NdcPoint, worldPoint: Vec3) => boolean,
  layoutCache: LabelLayoutCache,
  nowMs: number,
  labelMode: ViewLabelMode = "full",
): number {
  alloc.pushName(renderSceneLabelsInto.name);
  try {
    if (layoutCache.labelMode !== labelMode) {
      layoutCache.labelMode = labelMode;
      layoutCache.needsRelayout = true;
    }
    if (
      shouldRelayout(layoutCache, nowMs, screenWidth, screenHeight, labelCount)
    ) {
      layoutLabels(
        layoutCache,
        labels,
        labelCount,
        screenWidth,
        screenHeight,
        projectInto,
      );
      layoutCache.lastLayoutTimeMs = nowMs;
      layoutCache.lastScreenWidth = screenWidth;
      layoutCache.lastScreenHeight = screenHeight;
      layoutCache.lastLabelCount = labelCount;
      layoutCache.needsRelayout = false;
    }

    return renderLabelsFromCache(
      into,
      layoutCache,
      screenWidth,
      screenHeight,
      projectInto,
    );
  } finally {
    alloc.popName();
  }
}

function shouldRelayout(
  cache: LabelLayoutCache,
  nowMs: number,
  screenWidth: number,
  screenHeight: number,
  labelCount: number,
): boolean {
  if (cache.needsRelayout) return true;
  if (screenWidth !== cache.lastScreenWidth) return true;
  if (screenHeight !== cache.lastScreenHeight) return true;
  if (labelCount !== cache.lastLabelCount) return true;
  return nowMs - cache.lastLayoutTimeMs >= LABEL_LAYOUT_INTERVAL_MS;
}

function layoutLabels(
  cache: LabelLayoutCache,
  labels: SceneLabelCandidate[],
  labelCount: number,
  screenWidth: number,
  screenHeight: number,
  projectInto: (into: NdcPoint, worldPoint: Vec3) => boolean,
): void {
  cache.labelById.clear();
  for (let i = 0; i < labelCount; i++) {
    cache.labelById.set(labels[i].id, labels[i]);
  }

  clearSpatialGrid(cache.grid);

  allAnchorsCount = collectVisibleAnchors(
    cache.grid,
    labels,
    labelCount,
    projectInto,
    screenWidth,
    screenHeight,
  );

  const sortedCount = sortLabels(labels, labelCount);

  if (cache.sortedLabels.length < sortedCount) {
    cache.sortedLabels.length = sortedCount;
  }
  for (let i = 0; i < sortedCount; i++) {
    cache.sortedLabels[i] = sortedScratch[i].label;
  }
  cache.sortedLabels.length = sortedCount;

  placedLabelCount = 0;

  let item: SortedScratchItem;
  let label: SceneLabelCandidate;
  for (let i = 0; i < sortedCount; i++) {
    item = sortedScratch[i];
    label = item.label;
    if (!projectInto(ndcScratch, label.anchor)) {
      continue;
    }

    ndc.toScreenInto(anchor, ndcScratch, screenWidth, screenHeight);
    if (
      anchor.x < 0 ||
      anchor.x > screenWidth ||
      anchor.y < 0 ||
      anchor.y > screenHeight
    ) {
      continue;
    }

    if (
      label.parentId &&
      !isParentLabelSeparated(
        label,
        cache,
        anchor,
        screenWidth,
        screenHeight,
        projectInto,
      )
    ) {
      continue;
    }

    const lineCount = fillLabelLines(lines, label);

    const maxTextWidth = getTextWidth(lines, lineCount, cache.charWidth);
    boxSize.width = maxTextWidth + padding.width * 2;
    boxSize.height = lineCount * lineHeight + padding.height * 2;

    const directionIndex = pickDirectionIndexForLabel(
      cache.grid,
      anchor,
      boxSize,
      angleStepRad,
    );

    getBoxCenterInto(boxCenter, directionIndex, angleStepRad, anchor);
    position.x = boxCenter.x - boxSize.width * 0.5;
    position.y = boxCenter.y - boxSize.height * 0.5;

    getEdgeFromDirectionInto(
      edgePoint,
      directionIndex,
      boxCenter,
      position,
      boxSize,
    );

    registerPlacedLabel(cache.grid, position, boxSize);
    updateCacheEntry(cache, label.id, directionIndex, boxSize);
  }
}

function renderLabelsFromCache(
  into: RenderedSceneLabel[],
  cache: LabelLayoutCache,
  screenWidth: number,
  screenHeight: number,
  projectInto: (into: NdcPoint, worldPoint: Vec3) => boolean,
): number {
  let count = 0;
  const sortedLabels = cache.sortedLabels;
  for (let i = 0; i < sortedLabels.length; i++) {
    const label = sortedLabels[i];
    if (!label) continue;
    if (!projectInto(ndcScratch, label.anchor)) {
      continue;
    }

    ndc.toScreenInto(anchor, ndcScratch, screenWidth, screenHeight);
    if (
      anchor.x < 0 ||
      anchor.x > screenWidth ||
      anchor.y < 0 ||
      anchor.y > screenHeight
    ) {
      continue;
    }

    if (
      label.parentId &&
      !isParentLabelSeparated(
        label,
        cache,
        anchor,
        screenWidth,
        screenHeight,
        projectInto,
      )
    ) {
      continue;
    }

    const lineCount = fillLabelLines(lines, label);

    const maxTextWidth = getTextWidth(lines, lineCount, cache.charWidth);
    boxSize.width = maxTextWidth + padding.width * 2;
    boxSize.height = lineCount * lineHeight + padding.height * 2;

    let entry = cache.entries.get(label.id);
    if (!entry) {
      entry = createCacheEntry(label.id, cache);
      cache.needsRelayout = true;
    }

    if (
      Math.abs(entry.size.width - boxSize.width) > 8 ||
      Math.abs(entry.size.height - boxSize.height) > 8
    ) {
      entry.size.width = boxSize.width;
      entry.size.height = boxSize.height;
      cache.needsRelayout = true;
    }

    const directionIndex = entry.directionIndex;
    getBoxCenterInto(boxCenter, directionIndex, angleStepRad, anchor);
    position.x = boxCenter.x - boxSize.width * 0.5;
    position.y = boxCenter.y - boxSize.height * 0.5;

    getEdgeFromDirectionInto(
      edgePoint,
      directionIndex,
      boxCenter,
      position,
      boxSize,
    );

    let current = into[count];
    if (current) {
      current.anchor.x = anchor.x;
      current.anchor.y = anchor.y;
      current.edgePoint.x = edgePoint.x;
      current.edgePoint.y = edgePoint.y;
      current.lineHeight = lineHeight;
      current.lines.length = lineCount;
      for (let i = 0; i < lineCount; i++) {
        current.lines[i] = lines[i];
      }
      current.name = lines[0];
      current.padding.height = padding.height;
      current.padding.width = padding.width;
      current.position.x = position.x;
      current.position.y = position.y;
      current.size.width = boxSize.width;
      current.size.height = boxSize.height;
    } else {
      const labelLines = new Array<string>(lineCount);
      for (let i = 0; i < lineCount; i++) {
        labelLines[i] = lines[i];
      }
      current = into[count] = {
        anchor: { x: anchor.x, y: anchor.y },
        edgePoint: { x: edgePoint.x, y: edgePoint.y },
        lineHeight,
        lines: labelLines,
        name: lines[0],
        padding: { height: padding.height, width: padding.width },
        position: { x: position.x, y: position.y },
        size: { height: boxSize.height, width: boxSize.width },
      };
    }
    count++;
  }

  return count;
}

function isParentLabelSeparated(
  label: SceneLabelCandidate,
  cache: LabelLayoutCache,
  anchor: Point,
  screenWidth: number,
  screenHeight: number,
  projectInto: (into: NdcPoint, worldPoint: Vec3) => boolean,
): boolean {
  const parentId = label.parentId;
  if (!parentId || parentId === label.id) return true;

  const parent = cache.labelById.get(parentId);
  if (!parent) {
    return true;
  }

  if (!projectInto(parentNdcScratch, parent.anchor)) {
    return true;
  }

  ndc.toScreenInto(parentAnchor, parentNdcScratch, screenWidth, screenHeight);
  if (
    parentAnchor.x < 0 ||
    parentAnchor.x > screenWidth ||
    parentAnchor.y < 0 ||
    parentAnchor.y > screenHeight
  ) {
    return true;
  }

  const dx = Math.abs(parentAnchor.x - anchor.x);
  const dy = Math.abs(parentAnchor.y - anchor.y);
  return dx >= 1 || dy >= 1;
}

function updateCacheEntry(
  cache: LabelLayoutCache,
  id: string,
  directionIndex: number,
  size: Size,
): void {
  let entry = cache.entries.get(id);
  if (!entry) {
    entry = {
      directionIndex,
      size: { width: size.width, height: size.height },
    };
    cache.entries.set(id, entry);
    return;
  }
  entry.directionIndex = directionIndex;
  entry.size.width = size.width;
  entry.size.height = size.height;
}

function createCacheEntry(
  id: string,
  cache: LabelLayoutCache,
): LabelLayoutEntry {
  const entry = {
    directionIndex: 1,
    size: { width: 0, height: 0 },
  };
  cache.entries.set(id, entry);
  return entry;
}

function clearSpatialGrid(grid: LabelSpatialGrid): void {
  grid.cells.clear();
}

function registerPlacedLabel(
  grid: LabelSpatialGrid,
  { x, y }: Point,
  { width, height }: Size,
): void {
  let rect: LabelRect;
  if (placedLabelCount < placedLabelRectsScratch.length) {
    rect = placedLabelRectsScratch[placedLabelCount];
    rect.x = x;
    rect.y = y;
    rect.width = width;
    rect.height = height;
  } else {
    rect = { x, y, width, height };
    placedLabelRectsScratch.push(rect);
  }

  addRectToGrid(grid, placedLabelCount, rect);
  placedLabelCount++;
}

function registerAnchor(grid: LabelSpatialGrid, { x, y }: Point): void {
  if (allAnchorsCount < allAnchorsScratch.length) {
    const dst = allAnchorsScratch[allAnchorsCount];
    dst.x = x;
    dst.y = y;
  } else {
    allAnchorsScratch.push({ x, y });
  }

  addCenterToGrid(grid, allAnchorsCount, allAnchorsScratch[allAnchorsCount]);
  allAnchorsCount++;
}

function addRectToGrid(
  grid: LabelSpatialGrid,
  index: number,
  rect: LabelRect,
): void {
  const cellSize = grid.cellSize;
  const minCx = Math.floor(rect.x / cellSize);
  const maxCx = Math.floor((rect.x + rect.width) / cellSize);
  const minCy = Math.floor(rect.y / cellSize);
  const maxCy = Math.floor((rect.y + rect.height) / cellSize);

  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cy = minCy; cy <= maxCy; cy++) {
      const cell = getGridCell(grid, cx, cy);
      cell.labels.push(index);
    }
  }
}

function addCenterToGrid(
  grid: LabelSpatialGrid,
  index: number,
  center: Point,
): void {
  const cellSize = grid.cellSize;
  const cx = Math.floor(center.x / cellSize);
  const cy = Math.floor(center.y / cellSize);
  const cell = getGridCell(grid, cx, cy);
  cell.centers.push(index);
}

function getGridCell(
  grid: LabelSpatialGrid,
  cx: number,
  cy: number,
): LabelGridCell {
  const key = `${cx},${cy}`;
  let cell = grid.cells.get(key);
  if (!cell) {
    cell = { labels: [], centers: [] };
    grid.cells.set(key, cell);
  }
  return cell;
}

function collectVisibleAnchors(
  grid: LabelSpatialGrid,
  labels: SceneLabelCandidate[],
  labelCount: number,
  projectInto: (into: NdcPoint, worldPoint: Vec3) => boolean,
  screenWidth: number,
  screenHeight: number,
): number {
  allAnchorsCount = 0;

  for (let i = 0; i < labelCount; i++) {
    const label = labels[i];

    if (!projectInto(ndcScratch, label.anchor)) {
      continue; // behind the camera
    }

    ndc.toScreenInto(anchor, ndcScratch, screenWidth, screenHeight);

    if (
      anchor.x < 0 ||
      anchor.x > screenWidth ||
      anchor.y < 0 ||
      anchor.y > screenHeight
    ) {
      continue;
    }

    registerAnchor(grid, anchor);
  }

  return allAnchorsCount;
}

function sortLabels(labels: SceneLabelCandidate[], labelCount: number): number {
  let count = 0;

  for (let i = 0; i < labelCount; i++) {
    const label = labels[i];
    if (count < sortedScratch.length) {
      const entry = sortedScratch[count];
      entry.label = label;
    } else {
      sortedScratch.push({
        label,
      });
    }
    count++;
  }

  sortRangeInPlace(sortedScratch, count, compareByPriorityAsc);
  return count;
}

function compareByPriorityAsc(a: SortedScratchItem, b: SortedScratchItem) {
  return (a.label.priority ?? 0) - (b.label.priority ?? 0);
}

function fillLabelLines(into: string[], label: SceneLabelCandidate): number {
  const labelLines = label.lines;
  const lineCount = labelLines.length;
  for (let i = 0; i < lineCount; i++) {
    into[i] = labelLines[i];
  }
  return lineCount;
}

/**
 * Pick a direction index (0..7) in 45° steps such that the label's rectangle
 * neither overlaps existing label rectangles nor contains any visible
 * label anchor, if possible.
 *
 * Angles:
 *   0 -> 0°   (up)
 *   1 -> 45°  (up-right)
 *   2 -> 90°  (right)
 *   3 -> 135°
 *   4 -> 180° (down)
 *   5 -> 225°
 *   6 -> 270° (left)
 *   7 -> 315°
 *
 * The search always starts at index 1 (45°), then 2,3,...,7,0, and falls
 * back to 1 if all candidate rectangles would be occupied.
 */
function pickDirectionIndexForLabel(
  grid: LabelSpatialGrid,
  anchor: Point,
  size: Size,
  angleStepRad: number,
): number {
  const startIndex = 1; // 45°
  const maxDirs = 8;

  let chosenIndex = startIndex;
  let foundFree = false;

  for (let i = 0; i < maxDirs; i++) {
    const directionIndex = (startIndex + i) & 7;

    getBoxCenterInto(center, directionIndex, angleStepRad, anchor);

    candidate.x = center.x - size.width * 0.5;
    candidate.y = center.y - size.height * 0.5;

    if (!candidateRectOccupied(grid, candidate, size)) {
      chosenIndex = directionIndex;
      foundFree = true;
      break;
    }
  }

  if (!foundFree) {
    chosenIndex = startIndex;
  }

  return chosenIndex;
}

/**
 * Returns true if the candidate rectangle:
 *  - overlaps any previously placed label rectangle, or
 *  - contains the projected anchor of any visible label.
 */
function candidateRectOccupied(
  grid: LabelSpatialGrid,
  { x, y }: Point,
  { width, height }: Size,
): boolean {
  const x2 = x + width;
  const y2 = y + height;
  const cellSize = grid.cellSize;
  const minCx = Math.floor(x / cellSize);
  const maxCx = Math.floor(x2 / cellSize);
  const minCy = Math.floor(y / cellSize);
  const maxCy = Math.floor(y2 / cellSize);

  for (let cx = minCx; cx <= maxCx; cx++) {
    for (let cy = minCy; cy <= maxCy; cy++) {
      const cell = grid.cells.get(`${cx},${cy}`);
      if (!cell) continue;

      // 1) Check overlap with already placed label rectangles.
      for (let i = 0; i < cell.labels.length; i++) {
        const rect = placedLabelRectsScratch[cell.labels[i]];
        const rx2 = rect.x + rect.width;
        const ry2 = rect.y + rect.height;

        const overlap = x < rx2 && x2 > rect.x && y < ry2 && y2 > rect.y;
        if (overlap) {
          return true;
        }
      }

      // 2) Check if this candidate contains any visible label anchor.
      for (let i = 0; i < cell.centers.length; i++) {
        const c = allAnchorsScratch[cell.centers[i]];
        if (c.x >= x && c.x <= x2 && c.y >= y && c.y <= y2) {
          return true;
        }
      }
    }
  }

  return false;
}

function getBoxCenterInto(
  boxCenter: Point,
  directionIndex: number,
  angleStepRad: number,
  anchor: Point,
): void {
  const offsetRadius = 150; // pixels from anchor to box center
  const angleRad = directionIndex * angleStepRad;
  const ux = Math.sin(angleRad);
  const uy = -Math.cos(angleRad);

  // Box is placed at a fixed offset from the anchor.
  boxCenter.x = anchor.x - ux * offsetRadius;
  boxCenter.y = anchor.y - uy * offsetRadius;
}

/**
 * Direction index:
 *   0 -> 0°   (top)
 *   1 -> 45°
 *   2 -> 90°  (right)
 *   3 -> 135°
 *   4 -> 180° (bottom)
 *   5 -> 225°
 *   6 -> 270° (left)
 *   7 -> 315°
 */
function getEdgeFromDirectionInto(
  into: Point,
  directionIndex: number,
  { x: boxCenterX, y: boxCenterY }: Point,
  { x: boxX, y: boxY }: Point,
  { width: boxWidth, height: boxHeight }: Size,
): void {
  into.x = boxCenterX;
  into.y = boxCenterY;

  switch (directionIndex) {
    case 0: // top: box is below anchor, connect to top-middle (toward anchor)
      into.x = boxCenterX;
      into.y = boxY;
      break;

    case 1:
      // top-right: box is below-left of anchor.
      // Anchor is above-right of box, so use top-right corner.
      into.x = boxX + boxWidth;
      into.y = boxY;
      break;

    case 2:
      // right: box is left of anchor, connect to right-middle (toward anchor)
      into.x = boxX + boxWidth;
      into.y = boxCenterY;
      break;

    case 3:
      // bottom-right: box is above-left of anchor.
      // Anchor is below-right of box, so use bottom-right corner.
      into.x = boxX + boxWidth;
      into.y = boxY + boxHeight;
      break;

    case 4:
      // bottom: box is above anchor, connect to bottom-middle (toward anchor)
      into.x = boxCenterX;
      into.y = boxY + boxHeight;
      break;

    case 5:
      // bottom-left: box is above-right of anchor.
      // Anchor is below-left of box, so use bottom-left corner.
      into.x = boxX;
      into.y = boxY + boxHeight;
      break;

    case 6:
      // left: box is right of anchor, connect to left-middle (toward anchor)
      into.x = boxX;
      into.y = boxCenterY;
      break;

    case 7:
      // top-left: box is below-right of anchor.
      // Anchor is above-left of box, so use top-left corner.
      into.x = boxX;
      into.y = boxY;
      break;
  }
}

function getTextWidth(lines: string[], lineCount: number, charWidth: number) {
  let maxTextWidth = 0;
  for (let i = 0; i < lineCount; i++) {
    const w = lines[i].length * charWidth;
    if (w > maxTextWidth) maxTextWidth = w;
  }
  return maxTextWidth;
}
