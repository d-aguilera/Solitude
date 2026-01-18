import type { Scene } from "../appScene/appScenePorts.js";
import type { Vec3 } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import { ndcToScreen } from "../render/shadedFaces.js";
import type { NdcPoint } from "../scene/scenePorts.js";
import type {
  RenderPlane,
  ViewDebugOverlayRenderer,
} from "../render/renderPorts.js";

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
 * a plane's velocity direction.
 */
function getPlaneVelocitySegments(plane: RenderPlane): VelocityDebugSegment[] {
  const v = plane.velocity;
  const speed = vec3.length(v);
  if (speed === 0) return [];

  const dir = vec3.normalize(v);
  const center = plane.position;

  const len = 5000; // meters
  const innerRadius = 8; // meters
  if (len <= innerRadius) return [];

  const forwardInner: Vec3 = vec3.add(center, vec3.scale(dir, innerRadius));
  const forwardEnd: Vec3 = vec3.add(center, vec3.scale(dir, len));

  const backwardInner: Vec3 = vec3.add(center, vec3.scale(dir, -innerRadius));
  const backwardEnd: Vec3 = vec3.add(center, vec3.scale(dir, -len));

  return [
    { start: forwardInner, end: forwardEnd, color: "forward" },
    { start: backwardInner, end: backwardEnd, color: "backward" },
  ];
}

export function drawPlaneVelocityLine(
  overlay: ViewDebugOverlayRenderer,
  project: ProjectFn,
  plane: RenderPlane,
  surfaceWidth: number,
  surfaceHeight: number,
): void {
  const segments = getPlaneVelocitySegments(plane);
  if (segments.length === 0) return;

  const overlaySegments = [];

  for (const seg of segments) {
    const ndcStart = project(seg.start);
    const ndcEnd = project(seg.end);
    if (!ndcStart || !ndcEnd) continue;

    const pStart = ndcToScreen(ndcStart, surfaceWidth, surfaceHeight);
    const pEnd = ndcToScreen(ndcEnd, surfaceWidth, surfaceHeight);

    overlaySegments.push({
      start: pStart,
      end: pEnd,
      color: seg.color,
    });
  }

  if (overlaySegments.length > 0) {
    overlay.drawPlaneVelocityLine(overlaySegments);
  }
}

export function drawBodyLabels(
  overlay: ViewDebugOverlayRenderer,
  project: ProjectFn,
  scene: Scene,
  referencePosition: Vec3,
  surfaceWidth: number,
  surfaceHeight: number,
): void {
  const bodies: {
    obj: Scene["objects"][number];
    distance: number;
  }[] = [];

  for (const obj of scene.objects) {
    if (obj.kind !== "planet" && obj.kind !== "star") continue;

    const d = vec3.length(vec3.sub(obj.position, referencePosition));
    bodies.push({ obj, distance: d });
  }

  bodies.sort((a, b) => b.distance - a.distance);

  for (const { obj, distance } of bodies) {
    if (obj.kind !== "planet" && obj.kind !== "star") continue;

    const ndc = project(obj.position);
    if (!ndc) continue;

    const screenPoint = ndcToScreen(ndc, surfaceWidth, surfaceHeight);

    const name = displayNameForBodyId(obj.id);

    const dKm = distance / 1000;
    const speedMps = vec3.length(obj.velocity);
    const speedKmh = speedMps * 3.6;

    overlay.drawBodyLabel({
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
