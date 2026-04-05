import type {
  PlanetSceneObject,
  SceneObject,
  StarSceneObject,
} from "../app/scenePorts";
import type { BodyId } from "../domain/domainPorts";
import { type Vec3, vec3 } from "../domain/vec3";
import { alloc } from "../global/allocProfiler";
import { formatDistance, formatSpeed } from "./formatters";
import { type NdcPoint, ndc } from "./ndc";
import type {
  Point,
  RenderedBodyLabel,
  Size,
  TextMetrics,
} from "./renderPorts";
import { scrn } from "./scrn";
import { sortRangeInPlace } from "./sortRange";

type SortedScratchItem = {
  body: PlanetSceneObject | StarSceneObject;
  distance: number;
};

const sortedScratch: SortedScratchItem[] = [];
const diffScratch: Vec3 = vec3.zero();
const ndcScratch: NdcPoint = ndc.zero();

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
 * Scratch structure for tracking all projected planet/star centers that are
 * in front of the camera and on-screen during a single render pass.
 */
let allBodyCentersCount = 0;
const allBodyCentersScratch: Point[] = [];
const anchor = scrn.zero();
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
const font = "14px monospace";
const lineHeight = 16;
const padding: Size = { width: 6, height: 4 };

/**
 * Sample and prepare body labels:
 *  - Computes distance and speed for each body.
 *  - Projects body centers into screen space.
 *  - Skips labels for bodies whose centers are off‑screen.
 *  - Chooses a label placement direction by probing 8 angles at 45° steps,
 *    starting from 45° (up/right).
 *  - A candidate label rectangle is considered free iff:
 *      * it does not overlap any previously placed label rectangle, and
 *      * it does not contain the center of any planet/star that is
 *        in front of the camera and on-screen.
 */
export function renderBodyLabelsInto(
  into: RenderedBodyLabel[],
  objects: SceneObject[],
  referencePosition: Vec3,
  screenWidth: number,
  screenHeight: number,
  projectInto: (into: NdcPoint, worldPoint: Vec3) => boolean,
  measureText: (text: string, font: string) => TextMetrics,
  objectsFilter?: (obj: SceneObject) => boolean,
): number {
  return alloc.withName(renderBodyLabelsInto.name, () => {
    // Pre-pass: collect all visible, on-screen body centers so that
    // label placement can avoid covering *any* planet/star center.
    allBodyCentersCount = collectVisibleBodyCenters(
      objects,
      projectInto,
      screenWidth,
      screenHeight,
      objectsFilter,
    );

    const sortedCount = sortBodies(objects, referencePosition, objectsFilter);

    // Clear per-pass label-rectangle scratch state
    placedLabelCount = 0;

    let count = 0;
    for (let i = 0; i < sortedCount; i++) {
      const { body, distance } = sortedScratch[i];
      if (!projectInto(ndcScratch, body.position)) {
        continue; // behind the camera
      }

      ndc.toScreenInto(anchor, ndcScratch, screenWidth, screenHeight);

      // 1) If the body's center is off the screen, skip the label.
      if (
        anchor.x < 0 ||
        anchor.x > screenWidth ||
        anchor.y < 0 ||
        anchor.y > screenHeight
      ) {
        continue;
      }

      lines[0] = displayNameForBodyId(body.id);
      lines[1] = "d=".concat(formatDistance(distance));
      lines[2] = "v=".concat(formatSpeed(vec3.length(body.velocity)));

      const maxTextWidth = getTextWidth(lines, font, measureText);

      boxSize.width = maxTextWidth + padding.width * 2;
      boxSize.height = lines.length * lineHeight + padding.height * 2;

      // 2–5) Choose a direction by probing 8 angles starting from 45°.
      const directionIndex = pickDirectionIndexForLabel(
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

      // Register this label's rectangle so future labels can avoid overlapping it.
      registerPlacedLabel(position, boxSize);

      let current = into[count];
      if (current) {
        current.anchor.x = anchor.x;
        current.anchor.y = anchor.y;
        current.edgePoint.x = edgePoint.x;
        current.edgePoint.y = edgePoint.y;
        current.lineHeight = lineHeight;
        current.lines[0] = lines[0];
        current.lines[1] = lines[1];
        current.lines[2] = lines[2];
        current.name = lines[0];
        current.padding.height = padding.height;
        current.padding.width = padding.width;
        current.position.x = position.x;
        current.position.y = position.y;
        current.size.width = boxSize.width;
        current.size.height = boxSize.height;
      } else {
        current = into[count] = {
          anchor: { x: anchor.x, y: anchor.y },
          edgePoint: { x: edgePoint.x, y: edgePoint.y },
          lineHeight,
          lines: [lines[0], lines[1], lines[2]],
          name: lines[0],
          padding: { height: padding.height, width: padding.width },
          position: { x: position.x, y: position.y },
          size: { height: boxSize.height, width: boxSize.width },
        };
      }
      count++;
    }

    return count;
  });
}

/**
 * Collect all planet/star centers that are:
 *  - in front of the camera, and
 *  - inside the screen rectangle.
 *
 * Returns the number of centers stored in allBodyCentersScratch.
 */
function collectVisibleBodyCenters(
  objects: SceneObject[],
  projectInto: (into: NdcPoint, worldPoint: Vec3) => boolean,
  screenWidth: number,
  screenHeight: number,
  objectsFilter?: (obj: SceneObject) => boolean,
): number {
  let count = 0;

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    if (obj.kind !== "planet" && obj.kind !== "star") continue;
    if (objectsFilter && !objectsFilter(obj)) continue;

    if (!projectInto(ndcScratch, obj.position)) {
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

    if (count < allBodyCentersScratch.length) {
      const dst = allBodyCentersScratch[count];
      dst.x = anchor.x;
      dst.y = anchor.y;
    } else {
      allBodyCentersScratch.push({ x: anchor.x, y: anchor.y });
    }
    count++;
  }

  return count;
}

function sortBodies(
  objects: SceneObject[],
  referencePosition: Vec3,
  objectsFilter?: (obj: PlanetSceneObject | StarSceneObject) => boolean,
): number {
  let count = 0;

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    if (obj.kind !== "planet" && obj.kind !== "star") continue;
    const body: PlanetSceneObject | StarSceneObject = obj;
    if (objectsFilter && !objectsFilter(body)) continue;

    vec3.subInto(diffScratch, body.position, referencePosition);
    const distance = vec3.length(diffScratch);
    if (count < sortedScratch.length) {
      const entry = sortedScratch[count];
      entry.body = body;
      entry.distance = distance;
    } else {
      sortedScratch.push({
        body,
        distance,
      });
    }
    count++;
  }

  // Farther to nearer so nearer labels are processed last.
  sortRangeInPlace(sortedScratch, count, compareByDistanceDesc);
  return count;
}

function compareByDistanceDesc(a: SortedScratchItem, b: SortedScratchItem) {
  return b.distance - a.distance;
}

function displayNameForBodyId(id: BodyId): string {
  const parts = id.split(":");
  const raw = parts[parts.length - 1] || id;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Pick a direction index (0..7) in 45° steps such that the label's rectangle
 * neither overlaps existing label rectangles nor contains any visible
 * planet/star center, if possible.
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

    if (!candidateRectOccupied(candidate, size)) {
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
 *  - contains the projected center of any visible planet/star.
 */
function candidateRectOccupied(
  { x, y }: Point,
  { width, height }: Size,
): boolean {
  const x2 = x + width;
  const y2 = y + height;

  // 1) Check overlap with already placed label rectangles.
  for (let i = 0; i < placedLabelCount; i++) {
    const rect = placedLabelRectsScratch[i];
    const rx2 = rect.x + rect.width;
    const ry2 = rect.y + rect.height;

    const overlap = x < rx2 && x2 > rect.x && y < ry2 && y2 > rect.y;

    if (overlap) {
      return true;
    }
  }

  // 2) Check if this candidate contains any visible planet/star center.
  for (let i = 0; i < allBodyCentersCount; i++) {
    const c = allBodyCentersScratch[i];
    if (c.x >= x && c.x <= x2 && c.y >= y && c.y <= y2) {
      return true;
    }
  }

  return false;
}

/**
 * Register a new placed label rectangle into a grow-only scratch array.
 */
function registerPlacedLabel({ x, y }: Point, { width, height }: Size): void {
  if (placedLabelCount < placedLabelRectsScratch.length) {
    const r = placedLabelRectsScratch[placedLabelCount];
    r.x = x;
    r.y = y;
    r.width = width;
    r.height = height;
  } else {
    placedLabelRectsScratch.push({ x, y, width, height });
  }

  placedLabelCount++;
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

function getTextWidth(
  lines: string[],
  font: string,
  measureText: (text: string, font: string) => TextMetrics,
) {
  let maxTextWidth = 0;
  for (const line of lines) {
    const w = measureText(line, font).width;
    if (w > maxTextWidth) maxTextWidth = w;
  }
  return maxTextWidth;
}
