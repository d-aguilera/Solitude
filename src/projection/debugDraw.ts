import type { Scene } from "../appScene/appScenePorts.js";
import type { Vec3 } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import { ndcToScreen } from "../render/shadedFaces.js";
import type { NdcPoint } from "../scene/scenePorts.js";
import type { DebugPlane } from "./projectionPorts.js";

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
function getPlaneVelocitySegments(plane: DebugPlane): VelocityDebugSegment[] {
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
  ctx: CanvasRenderingContext2D,
  project: ProjectFn,
  plane: DebugPlane,
): void {
  const segments = getPlaneVelocitySegments(plane);
  if (segments.length === 0) return;

  const { width, height } = ctx.canvas;

  ctx.save();
  ctx.lineWidth = 4;

  for (const seg of segments) {
    const ndcStart = project(seg.start);
    const ndcEnd = project(seg.end);
    if (!ndcStart || !ndcEnd) continue;

    const pStart = ndcToScreen(ndcStart, width, height);
    const pEnd = ndcToScreen(ndcEnd, width, height);

    ctx.strokeStyle = seg.color === "forward" ? "lime" : "red";
    ctx.beginPath();
    ctx.moveTo(pStart.x, pStart.y);
    ctx.lineTo(pEnd.x, pEnd.y);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawBodyLabels(
  ctx: CanvasRenderingContext2D,
  project: ProjectFn,
  scene: Scene,
  referencePosition: Vec3,
): void {
  ctx.save();
  ctx.font = "14px monospace";
  ctx.textBaseline = "middle";

  const { width, height } = ctx.canvas;

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

    const screenPoint = ndcToScreen(ndc, width, height);

    const name = displayNameForBodyId(obj.id);

    const dKm = distance / 1000;
    const distanceText = `d=${dKm.toFixed(0)} km`;

    const speedMps = vec3.length(obj.velocity);
    const speedKmh = speedMps * 3.6;
    const speedText = `v=${speedKmh.toFixed(2)} km/h`;

    const lines = [name, distanceText, speedText];

    let maxTextWidth = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxTextWidth) maxTextWidth = w;
    }

    const paddingX = 6;
    const paddingY = 4;
    const boxWidth = maxTextWidth + paddingX * 2;
    const lineHeight = 16;
    const boxHeight = lines.length * lineHeight + paddingY * 2;

    const anchorX = screenPoint.x;
    const anchorY = screenPoint.y;

    const offsetX = 16;
    const offsetY = -24;
    const boxX = anchorX + offsetX;
    const boxY = anchorY + offsetY;

    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(boxX, boxY + boxHeight / 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

    ctx.strokeStyle = "white";
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    ctx.fillStyle = "white";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cy = boxY + paddingY + lineHeight * (i + 0.5);
      ctx.fillText(line, boxX + paddingX, cy);
    }
  }

  ctx.restore();
}

function displayNameForBodyId(id: string): string {
  const parts = id.split(":");
  const raw = parts[parts.length - 1] || id;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
