import type { ShipBody, Vec3 } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import { alloc } from "../global/allocProfiler.js";
import { ndcToScreen } from "./ndcToScreen.js";
import type { NdcPoint, RenderedSegment } from "./renderPorts.js";

const ndcStartScratch: NdcPoint = { x: 0, y: 0, depth: 0 };
const ndcEndScratch: NdcPoint = { x: 0, y: 0, depth: 0 };

export function renderVelocitySegments(
  ship: ShipBody,
  screenWidth: number,
  screenHeight: number,
  projectInto: (into: NdcPoint, worldPoint: Vec3) => boolean,
): RenderedSegment[] {
  return alloc.withName(renderVelocitySegments.name, () => {
    const segments = getShipVelocitySegments(ship);
    if (segments.length === 0) return [];

    const renderedSegments: RenderedSegment[] = [];

    for (const seg of segments) {
      if (
        !projectInto(ndcStartScratch, seg.start) ||
        !projectInto(ndcEndScratch, seg.end)
      )
        continue;

      const pStart = ndcToScreen(ndcStartScratch, screenWidth, screenHeight);
      const pEnd = ndcToScreen(ndcEndScratch, screenWidth, screenHeight);

      renderedSegments.push({
        start: pStart,
        end: pEnd,
        cssColor: seg.direction === "forward" ? "lime" : "red",
      });
    }

    return renderedSegments;
  });
}

/**
 * Pure helper that computes the world-space line segments representing
 * a ship's velocity direction.
 */
function getShipVelocitySegments(ship: ShipBody): VelocityDebugSegment[] {
  // Reuse a single scratch velocity vector.
  vec3.copyInto(velocityScratch, ship.velocity);

  const speedSq = vec3.lengthSq(velocityScratch);
  if (speedSq < 1e-24) return [];

  const dir = vec3.normalizeInto(velocityScratch);
  const center = ship.position;

  const len = 500000; // meters
  const innerRadius = 6; // meters

  vec3.scaledAdd(forwardInner, center, dir, innerRadius);
  vec3.scaledAdd(forwardEnd, center, dir, len);
  vec3.scaledAdd(backwardInner, center, dir, -innerRadius);
  vec3.scaledAdd(backwardEnd, center, dir, -len);

  // The returned segments reference stable, reused Vec3 instances.
  return [
    { start: forwardInner, end: forwardEnd, direction: "forward" },
    { start: backwardInner, end: backwardEnd, direction: "backward" },
  ];
}

// Shared scratch vectors for velocity debug segments.
const velocityScratch: Vec3 = vec3.zero();
const forwardInner: Vec3 = vec3.zero();
const forwardEnd: Vec3 = vec3.zero();
const backwardInner: Vec3 = vec3.zero();
const backwardEnd: Vec3 = vec3.zero();

interface VelocityDebugSegment {
  start: Vec3;
  end: Vec3;
  direction: "forward" | "backward";
}
