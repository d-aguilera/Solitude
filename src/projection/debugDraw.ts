import type { Vec3 } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import { ndcToScreen } from "../render/ndcToScreen.js";
import type {
  OverlayBody,
  RenderShip,
  ViewDebugOverlayRenderer,
} from "../render/renderPorts.js";
import type { RenderSurface2D } from "../app/appPorts.js";
import type { NdcPoint } from "../scene/scenePorts.js";

export type ProjectFn = (p: Vec3) => NdcPoint | null;

/**
 * World-space line segment for velocity debug visualization.
 */
interface VelocityDebugSegment {
  start: Vec3;
  end: Vec3;
  color: "forward" | "backward";
}

/**
 * Pure helper that computes the world-space line segments representing
 * a ship's velocity direction.
 */
function getShipVelocitySegments(ship: RenderShip): VelocityDebugSegment[] {
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
    { start: forwardInner, end: forwardEnd, color: "forward" },
    { start: backwardInner, end: backwardEnd, color: "backward" },
  ];
}

export function drawShipVelocityLine(
  overlay: ViewDebugOverlayRenderer,
  surface: RenderSurface2D,
  project: ProjectFn,
  ship: RenderShip,
): void {
  const segments = getShipVelocitySegments(ship);
  if (segments.length === 0) return;

  const overlaySegments = [];

  for (const seg of segments) {
    const ndcStart = project(seg.start);
    const ndcEnd = project(seg.end);
    if (!ndcStart || !ndcEnd) continue;

    const pStart = ndcToScreen(ndcStart, surface.width, surface.height);
    const pEnd = ndcToScreen(ndcEnd, surface.width, surface.height);

    overlaySegments.push({
      start: pStart,
      end: pEnd,
      color: seg.color,
    });
  }

  if (overlaySegments.length > 0) {
    overlay.drawShipVelocityLine(surface, overlaySegments);
  }
}

export function drawBodyLabels(
  overlay: ViewDebugOverlayRenderer,
  surface: RenderSurface2D,
  project: ProjectFn,
  bodies: OverlayBody[],
  referencePosition: Vec3,
): void {
  const sorted: {
    body: OverlayBody;
    distance: number;
  }[] = [];

  for (const body of bodies) {
    const d = vec3.length(vec3.sub(body.position, referencePosition));
    sorted.push({ body, distance: d });
  }

  sorted.sort((a, b) => b.distance - a.distance);

  for (const { body, distance } of sorted) {
    const ndc = project(body.position);
    if (!ndc) continue;

    const screenPoint = ndcToScreen(ndc, surface.width, surface.height);

    const name = displayNameForBodyId(body.id);

    const dKm = distance / 1000;
    const speedMps = vec3.length(body.velocity);
    const speedKmh = speedMps * 3.6;

    overlay.drawBodyLabel(surface, {
      anchor: screenPoint,
      name,
      distanceKm: dKm,
      speedKmh,
    });
  }
}

function displayNameForBodyId(id: string): string {
  const parts = id.split(":");
  const raw = parts[parts.length - 1] || id;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
