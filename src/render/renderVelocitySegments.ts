import type { ShipBody, Vec3 } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import { ndcToScreen } from "./ndcToScreen.js";
import type {
  NdcPoint,
  RenderSurface2D,
  RenderedSegment,
} from "./renderPorts.js";

export function renderVelocitySegments(
  { height, width }: RenderSurface2D,
  ship: ShipBody,
  project: (worldPoint: Vec3) => NdcPoint | null,
): RenderedSegment[] {
  const segments = getShipVelocitySegments(ship);
  if (segments.length === 0) return [];

  const renderedSegments: RenderedSegment[] = [];

  for (const seg of segments) {
    const ndcStart = project(seg.start);
    const ndcEnd = project(seg.end);
    if (!ndcStart || !ndcEnd) continue;

    const pStart = ndcToScreen(ndcStart, width, height);
    const pEnd = ndcToScreen(ndcEnd, width, height);

    renderedSegments.push({
      start: pStart,
      end: pEnd,
      cssColor: seg.direction === "forward" ? "lime" : "red",
    });
  }

  return renderedSegments;
}

/**
 * Pure helper that computes the world-space line segments representing
 * a ship's velocity direction.
 */
function getShipVelocitySegments(ship: ShipBody): VelocityDebugSegment[] {
  const v = ship.velocity;
  const speedSq = vec3.lengthSq(v);
  if (speedSq < 1e-24) return [];

  const dir = vec3.normalize(v);
  const center = ship.position;

  const len = 500000; // meters
  const innerRadius = 6; // meters

  const forwardInner: Vec3 = vec3.add(center, vec3.scale(dir, innerRadius));
  const forwardEnd: Vec3 = vec3.add(center, vec3.scale(dir, len));

  const backwardInner: Vec3 = vec3.add(center, vec3.scale(dir, -innerRadius));
  const backwardEnd: Vec3 = vec3.add(center, vec3.scale(dir, -len));

  return [
    { start: forwardInner, end: forwardEnd, direction: "forward" },
    { start: backwardInner, end: backwardEnd, direction: "backward" },
  ];
}

interface VelocityDebugSegment {
  start: Vec3;
  end: Vec3;
  direction: "forward" | "backward";
}
