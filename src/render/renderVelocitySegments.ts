import type { ShipBody, Vec3 } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import { ndc } from "./ndc.js";
import type { ProjectedSegment, SegmentProjector } from "./renderInternals.js";
import type { RenderedSegment } from "./renderPorts.js";
import { scrn } from "./scrn.js";

const projectedScratch: ProjectedSegment = {
  a: ndc.zero(),
  b: ndc.zero(),
  clipped: false,
};

export function renderVelocitySegmentsInto(
  into: RenderedSegment[],
  ship: ShipBody,
  projectSegmentInto: SegmentProjector,
): number {
  if (!mutateShipVelocitySegments(ship, segmentsScratch)) {
    return 0;
  }

  let count = 0;
  for (const seg of segmentsScratch) {
    if (!projectSegmentInto(projectedScratch, seg.start, seg.end)) continue;
    const cssColor = seg.direction === "forward" ? "lime" : "red";
    let entry = into[count];
    if (entry) {
      scrn.copy(projectedScratch.a, entry.start);
      scrn.copy(projectedScratch.b, entry.end);
      entry.cssColor = cssColor;
    } else {
      entry = into[count] = {
        start: scrn.copy(projectedScratch.a, scrn.zero()),
        end: scrn.copy(projectedScratch.b, scrn.zero()),
        cssColor,
      };
    }
    count++;
  }

  return count;
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
