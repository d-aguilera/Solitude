import type { ShipBody, Vec3 } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import { alloc } from "../global/allocProfiler.js";
import type { ProjectedSegment, SegmentProjector } from "./renderInternals.js";
import type { RenderedSegment } from "./renderPorts.js";

const projectedScratch: ProjectedSegment = {
  a: { x: 0, y: 0, depth: 0 },
  b: { x: 0, y: 0, depth: 0 },
  clipped: false,
};

export function renderVelocitySegments(
  ship: ShipBody,
  projectSegmentInto: SegmentProjector,
): RenderedSegment[] {
  return alloc.withName(renderVelocitySegments.name, () => {
    const renderedSegments: RenderedSegment[] = [];
    if (!mutateShipVelocitySegments(ship, segmentsScratch)) {
      return renderedSegments;
    }

    for (const seg of segmentsScratch) {
      if (!projectSegmentInto(projectedScratch, seg.start, seg.end)) continue;
      const { a, b } = projectedScratch;
      const start = { x: a.x, y: a.y, depth: a.depth };
      const end = { x: b.x, y: b.y, depth: b.depth };
      const cssColor = seg.direction === "forward" ? "lime" : "red";
      renderedSegments.push({ start, end, cssColor });
    }

    return renderedSegments;
  });
}

/**
 * Pure helper that computes the world-space line segments representing
 * a ship's velocity direction.
 */
function mutateShipVelocitySegments(
  ship: ShipBody,
  [forward, backward]: VelocityDebugSegment[],
): boolean {
  const { start: forwardStart, end: forwardEnd } = forward;
  const { start: backwardStart, end: backwardEnd } = backward;

  vec3.copyInto(velocityScratch, ship.velocity);

  const speedSq = vec3.lengthSq(velocityScratch);
  if (speedSq < 1e-24) {
    return false;
  }

  const dir = vec3.normalizeInto(velocityScratch);
  const center = ship.position;

  const len = 500000; // meters
  const innerRadius = 7; // meters

  vec3.scaledAddInto(forwardStart, center, dir, innerRadius);
  vec3.scaledAddInto(forwardEnd, center, dir, len);
  vec3.scaledAddInto(backwardStart, center, dir, -innerRadius);
  vec3.scaledAddInto(backwardEnd, center, dir, -len);

  return true;
}

// Shared scratch vectors for velocity debug segments.
const velocityScratch: Vec3 = vec3.zero();

const forwardScratch: VelocityDebugSegment = {
  start: vec3.zero(),
  end: vec3.zero(),
  direction: "forward",
};
const backwardScratch: VelocityDebugSegment = {
  start: vec3.zero(),
  end: vec3.zero(),
  direction: "backward",
};
const segmentsScratch: VelocityDebugSegment[] = [
  forwardScratch,
  backwardScratch,
];

interface VelocityDebugSegment {
  start: Vec3;
  end: Vec3;
  direction: "forward" | "backward";
}
