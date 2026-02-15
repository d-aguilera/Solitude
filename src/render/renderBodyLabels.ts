import type { PlanetSceneObject } from "../app/appPorts.js";
import type { BodyId, Vec3 } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import { alloc } from "../global/allocProfiler.js";
import { ndcToScreen } from "./ndcToScreen.js";
import type {
  NdcPoint,
  RenderedBodyLabel,
  TextMetrics,
} from "./renderPorts.js";

type SortedScratchItem = {
  body: PlanetSceneObject;
  distance: number;
};

const sortedScratch: SortedScratchItem[] = [];
const diffScratch: Vec3 = vec3.zero();
const ndcScratch: NdcPoint = { x: 0, y: 0, depth: 0 };

/**
 * Sample and prepare body labels:
 *  - Computes distance and speed for each body.
 *  - Projects body centers into screen space.
 *  - Chooses an 8-way direction index for label placement based on the
 *    vector from the body center toward the screen center, clamped to
 *    the nearest 45° increment.
 */
export function renderBodyLabels(
  bodies: PlanetSceneObject[],
  referencePosition: Vec3,
  screenWidth: number,
  screenHeight: number,
  projectInto: (into: NdcPoint, worldPoint: Vec3) => boolean,
  measureText: (text: string, font: string) => TextMetrics,
): RenderedBodyLabel[] {
  return alloc.withName(renderBodyLabels.name, () => {
    const renderedBodyLabels: RenderedBodyLabel[] = [];

    sortBodiesInto(sortedScratch, bodies, referencePosition);

    const angleStep = 45;
    const angleStepRad = (angleStep * Math.PI) / 180;

    const font = "14px monospace";
    const lineHeight = 16;
    const paddingX = 6;
    const paddingY = 4;

    for (const { body, distance } of sortedScratch) {
      if (!projectInto(ndcScratch, body.position)) {
        continue; // behind the camera
      }

      const anchor = ndcToScreen(ndcScratch, screenWidth, screenHeight);

      const name = displayNameForBodyId(body.id);
      const distanceKm = distance / 1000;
      const speedMps = vec3.length(body.velocity);
      const speedKmh = speedMps * 3.6;

      const lines = [
        name,
        "d=".concat(distanceKm.toFixed(0), " km"),
        "v=".concat(speedKmh.toFixed(0), " km/h"),
      ];

      let maxTextWidth = getTextWidth(lines, font, measureText);

      const boxWidth = maxTextWidth + paddingX * 2;
      const boxHeight = lines.length * lineHeight + paddingY * 2;

      // Vector from body center to screen center in screen space.
      const directionIndex = getDirectionIndex(
        screenWidth,
        screenHeight,
        anchor,
        angleStepRad,
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

      const renderedBodyLabel: RenderedBodyLabel = {
        anchor: { x: anchor.x, y: anchor.y, depth: 0 },
        distanceKm,
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
        speedKmh,
      };

      renderedBodyLabels.push(renderedBodyLabel);
    }

    return renderedBodyLabels;
  });
}

function sortBodiesInto(
  into: SortedScratchItem[],
  bodies: PlanetSceneObject[],
  referencePosition: Vec3,
) {
  const bl = bodies.length;
  const sl = into.length;
  into.length = bl;

  // Copy bodies into scratch array without allocating memory
  // and compute distances to reference position.
  for (let i = 0; i < sl; i++) {
    const entry = into[i];
    const body = bodies[i];
    vec3.subInto(diffScratch, body.position, referencePosition);
    entry.body = body;
    entry.distance = vec3.length(diffScratch);
  }

  // Grow scratch array if necessary
  // with distances to reference position.
  for (let i = sl; i < bl; i++) {
    const body = bodies[i];
    vec3.subInto(diffScratch, body.position, referencePosition);
    const distance = vec3.length(diffScratch);
    into[i] = { body, distance };
  }

  // Farther to nearer so nearer labels are processed last
  into.sort((a, b) => b.distance - a.distance);
}

function displayNameForBodyId(id: BodyId): string {
  const parts = id.split(":");
  const raw = parts[parts.length - 1] || id;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
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

  // Box is placed between anchor and screen center.
  const x = anchor.x - ux * offsetRadius;
  const y = anchor.y - uy * offsetRadius;

  return { x, y };
}

function getDirectionIndex(
  screenWidth: number,
  screenHeight: number,
  anchor: { x: number; y: number },
  angleStepRad: number,
) {
  const vx = screenWidth * 0.5 - anchor.x;
  const vy = screenHeight * 0.5 - anchor.y;

  // atan2 gives angle with 0 along +X; rotate so 0 corresponds to "up".
  let angle = Math.atan2(vy, vx) - Math.PI / 2;

  // Normalize to [0, 2π).
  const twoPi = Math.PI * 2;
  if (angle < 0) {
    angle = (angle % twoPi) + twoPi;
  } else if (angle >= twoPi) {
    angle = angle % twoPi;
  }

  // Clamp to nearest 45° increment.
  const quantized = Math.round(angle / angleStepRad);

  // Direction index:
  //   0 -> 0°   (top)
  //   1 -> 45°
  //   2 -> 90°  (right)
  //   3 -> 135°
  //   4 -> 180° (bottom)
  //   5 -> 225°
  //   6 -> 270° (left)
  //   7 -> 315°
  return quantized & 7; // keep in [0,7]
}

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
