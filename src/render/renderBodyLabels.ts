import type {
  PlanetSceneObject,
  SceneObject,
  StarSceneObject,
} from "../app/appPorts.js";
import type { BodyId, Vec3 } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import { alloc } from "../global/allocProfiler.js";
import { formatDistance, formatSpeed } from "./formatters.js";
import { ndcToScreen } from "./ndcToScreen.js";
import type {
  NdcPoint,
  RenderedBodyLabel,
  TextMetrics,
} from "./renderPorts.js";

type SortedScratchItem = {
  body: PlanetSceneObject | StarSceneObject;
  distance: number;
};

const sortedScratch: SortedScratchItem[] = [];
const diffScratch: Vec3 = vec3.zero();
const ndcScratch: NdcPoint = { x: 0, y: 0, depth: 0 };

/**
 * Scratch structure for tracking label centers across a single render pass.
 */
interface LabelCenter {
  x: number;
  y: number;
}

const labelCentersScratch: LabelCenter[] = [];
let labelCentersCount = 0;

/**
 * Sample and prepare body labels:
 *  - Computes distance and speed for each body.
 *  - Projects body centers into screen space.
 *  * - Skips labels for bodies whose centers are off‑screen.
 *  * - Chooses a label placement direction by probing 8 angles at 45° steps,
 *  *   starting from 45° (up/right), and picking the first that does not
 *  *   overlap already placed labels (using label centers + radius).
 */
export function renderBodyLabels(
  objects: SceneObject[],
  referencePosition: Vec3,
  screenWidth: number,
  screenHeight: number,
  projectInto: (into: NdcPoint, worldPoint: Vec3) => boolean,
  measureText: (text: string, font: string) => TextMetrics,
  objectsFilter?: (obj: SceneObject) => boolean,
): RenderedBodyLabel[] {
  return alloc.withName(renderBodyLabels.name, () => {
    const renderedBodyLabels: RenderedBodyLabel[] = [];

    const sorted: SortedScratchItem[] = sortBodies(
      objects,
      referencePosition,
      objectsFilter,
    );

    const angleStep = 45;
    const angleStepRad = (angleStep * Math.PI) / 180;

    // Label style
    const font = "14px monospace";
    const lineHeight = 16;
    const paddingX = 6;
    const paddingY = 4;

    // Clear per-pass label center scratch
    labelCentersCount = 0;

    // Radius used to check overlap between label centers (in pixels).
    const labelRadius = 80;
    const labelRadiusSq = labelRadius * labelRadius;

    for (const { body, distance } of sorted) {
      if (!projectInto(ndcScratch, body.position)) {
        continue; // behind the camera
      }

      const anchor = ndcToScreen(ndcScratch, screenWidth, screenHeight);

      // 1) If the body's center is off the screen, skip the label.
      if (
        anchor.x < 0 ||
        anchor.x > screenWidth ||
        anchor.y < 0 ||
        anchor.y > screenHeight
      ) {
        continue;
      }

      const name = displayNameForBodyId(body.id);
      const distanceLine = formatDistance(distance);
      const speedMps = vec3.length(body.velocity);
      const speedLine = formatSpeed(speedMps);

      const lines = [name, "d=".concat(distanceLine), "v=".concat(speedLine)];

      const maxTextWidth = getTextWidth(lines, font, measureText);

      const boxWidth = maxTextWidth + paddingX * 2;
      const boxHeight = lines.length * lineHeight + paddingY * 2;

      // 2–5) Choose a direction by probing 8 angles starting from 45°.
      const directionIndex = pickDirectionIndexForLabel(
        anchor,
        angleStepRad,
        labelRadiusSq,
      );

      // Offset direction in screen space for the LABEL BOX CENTER.
      const { x: boxCenterX, y: boxCenterY } = getBoxCenter(
        directionIndex,
        angleStepRad,
        anchor,
      );

      const boxX = boxCenterX - boxWidth * 0.5;
      const boxY = boxCenterY - boxHeight * 0.5;

      const { x: edgeX, y: edgeY } = getEdgeFromDirection(
        directionIndex,
        { x: boxCenterX, y: boxCenterY },
        { x: boxX, y: boxY },
        { width: boxWidth, height: boxHeight },
      );

      // Register this label's center so future labels can avoid overlapping it.
      registerLabelCenter(boxCenterX, boxCenterY);

      const renderedBodyLabel: RenderedBodyLabel = {
        anchor: { x: anchor.x, y: anchor.y, depth: 0 },
        lineHeight,
        lines,
        name,
        padding: {
          width: paddingX,
          height: paddingY,
        },
        position: {
          x: boxX,
          y: boxY,
          depth: 0,
        },
        size: {
          width: boxWidth,
          height: boxHeight,
        },
        edgePoint: {
          x: edgeX,
          y: edgeY,
          depth: 0,
        },
      };

      renderedBodyLabels.push(renderedBodyLabel);
    }

    return renderedBodyLabels;
  });
}

function sortBodies(
  objects: SceneObject[],
  referencePosition: Vec3,
  objectsFilter?: (obj: PlanetSceneObject | StarSceneObject) => boolean,
): SortedScratchItem[] {
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

  // Farther to nearer so nearer labels are processed last
  return sortedScratch.slice(0, count).sort((a, b) => b.distance - a.distance);
}

function displayNameForBodyId(id: BodyId): string {
  const parts = id.split(":");
  const raw = parts[parts.length - 1] || id;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Pick a direction index (0..7) in 45° steps such that the label's center
 * does not overlap existing labels, if possible.
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
 * back to 1 if all candidate centers would overlap.
 */
function pickDirectionIndexForLabel(
  anchor: { x: number; y: number },
  angleStepRad: number,
  labelRadiusSq: number,
): number {
  const startIndex = 1; // 45°
  const maxDirs = 8;

  let chosenIndex = startIndex;
  let foundFree = false;

  for (let i = 0; i < maxDirs; i++) {
    const directionIndex = (startIndex + i) & 7;

    const { x: cx, y: cy } = getBoxCenter(directionIndex, angleStepRad, anchor);

    if (!overlapsExistingLabel(cx, cy, labelRadiusSq)) {
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
 * Returns true if the proposed center overlaps any previously registered
 * label center using a simple radius-based check.
 */
function overlapsExistingLabel(
  cx: number,
  cy: number,
  radiusSq: number,
): boolean {
  for (let i = 0; i < labelCentersCount; i++) {
    const c = labelCentersScratch[i];
    const dx = cx - c.x;
    const dy = cy - c.y;
    if (dx * dx + dy * dy < radiusSq) {
      return true;
    }
  }
  return false;
}

/**
 * Register a new label center into the grow-only scratch array.
 */
function registerLabelCenter(cx: number, cy: number): void {
  if (labelCentersCount < labelCentersScratch.length) {
    const dst = labelCentersScratch[labelCentersCount];
    dst.x = cx;
    dst.y = cy;
  } else {
    labelCentersScratch.push({ x: cx, y: cy });
  }
  labelCentersCount++;
}

function getBoxCenter(
  directionIndex: number,
  angleStepRad: number,
  anchor: { x: number; y: number },
) {
  const offsetRadius = 150; // pixels from anchor to box center
  const angleRad = directionIndex * angleStepRad;
  const ux = Math.sin(angleRad);
  const uy = -Math.cos(angleRad);

  const x = anchor.x - ux * offsetRadius;
  const y = anchor.y - uy * offsetRadius;

  return { x, y };
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
function getEdgeFromDirection(
  directionIndex: number,
  boxCenter: { x: number; y: number },
  boxTopLeft: { x: number; y: number },
  boxSize: { width: number; height: number },
): { x: number; y: number } {
  const { x: boxCenterX, y: boxCenterY } = boxCenter;
  const { x: boxX, y: boxY } = boxTopLeft;
  const { width: boxWidth, height: boxHeight } = boxSize;

  let edgeX = boxCenterX;
  let edgeY = boxCenterY;

  switch (directionIndex) {
    case 0: // top: box is below anchor, connect to top-middle (toward anchor)
      edgeX = boxCenterX;
      edgeY = boxY;
      break;

    case 1:
      // top-right: box is below-left of anchor.
      // Anchor is above-right of box, so use top-right corner.
      edgeX = boxX + boxWidth;
      edgeY = boxY;
      break;

    case 2:
      // right: box is left of anchor, connect to right-middle (toward anchor)
      edgeX = boxX + boxWidth;
      edgeY = boxCenterY;
      break;

    case 3:
      // bottom-right: box is above-left of anchor.
      // Anchor is below-right of box, so use bottom-right corner.
      edgeX = boxX + boxWidth;
      edgeY = boxY + boxHeight;
      break;

    case 4:
      // bottom: box is above anchor, connect to bottom-middle (toward anchor)
      edgeX = boxCenterX;
      edgeY = boxY + boxHeight;
      break;

    case 5:
      // bottom-left: box is above-right of anchor.
      // Anchor is below-left of box, so use bottom-left corner.
      edgeX = boxX;
      edgeY = boxY + boxHeight;
      break;

    case 6:
      // left: box is right of anchor, connect to left-middle (toward anchor)
      edgeX = boxX;
      edgeY = boxCenterY;
      break;

    case 7:
      // top-left: box is below-right of anchor.
      // Anchor is above-left of box, so use top-left corner.
      edgeX = boxX;
      edgeY = boxY;
      break;
  }
  return { x: edgeX, y: edgeY };
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
