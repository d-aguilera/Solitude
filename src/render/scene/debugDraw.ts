import { Vec3 } from "../../world/domain.js";
import type { Plane, Scene } from "../../world/types.js";
import { vec } from "../../world/vec3.js";
import type { NdcPoint } from "../projection/projection.js";
import { ndcToScreen } from "../projection/projection.js";

export type ProjectFn = (p: Vec3) => NdcPoint | null;
/**
 * World-space line segment for velocity debug visualization.
 */
export interface VelocityDebugSegment {
  start: Vec3;
  end: Vec3;
  color: "forward" | "backward";
}

/**
 * Pure helper that computes the world-space line segments representing
 * a plane's velocity direction. This keeps the geometry / debug-data
 * concerns separate from the actual Canvas drawing.
 *
 * - Returns up to two segments (forward and backward), or an empty array
 *   if the plane has zero speed or the configured length is within
 *   the innerRadius dead-zone.
 */
export function getPlaneVelocitySegments(plane: Plane): VelocityDebugSegment[] {
  const v = plane.velocity;
  const speed = vec.length(v);
  if (speed === 0) return [];

  // Unit direction of motion
  const dir = vec.normalize(v);

  const center = plane.position;

  // Total segment length in world units, symmetric around plane center
  const len = 5000; // meters

  // Radius of a sphere around the plane where we don't draw
  const innerRadius = 8; // meters

  // If the segment would be fully inside the sphere, don't draw anything
  if (len <= innerRadius) return [];

  const forwardInner: Vec3 = vec.add(center, vec.scale(dir, innerRadius));
  const forwardEnd: Vec3 = vec.add(center, vec.scale(dir, len));

  const backwardInner: Vec3 = vec.add(center, vec.scale(dir, -innerRadius));
  const backwardEnd: Vec3 = vec.add(center, vec.scale(dir, -len));

  return [
    { start: forwardInner, end: forwardEnd, color: "forward" },
    { start: backwardInner, end: backwardEnd, color: "backward" },
  ];
}

/**
 * Draw a velocity direction line for a single plane in a given view.
 *
 * - Green: direction of motion (forward)
 * - Red: opposite direction of motion (backward)
 * - An inner radius around the plane is left empty to avoid clutter.
 *
 * This function focuses on Canvas2D drawing only; the world-space
 * geometry for the debug visualization is computed by
 * getPlaneVelocitySegments.
 */
export function drawPlaneVelocityLine(
  ctx: CanvasRenderingContext2D,
  project: ProjectFn,
  plane: Plane
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

/**
 * Draw labels for planets and stars:
 *  - Name
 *  - Distance to referencePlane
 *  - Body speed magnitude
 */
export function drawBodyLabels(
  ctx: CanvasRenderingContext2D,
  project: ProjectFn,
  scene: Scene,
  referencePlane: Plane
): void {
  ctx.save();
  ctx.font = "14px monospace";
  ctx.textBaseline = "middle";

  const refPos = referencePlane.position;
  const { width, height } = ctx.canvas;

  // Collect planet/star objects with their distance to the reference plane.
  const bodies: {
    obj: Scene["objects"][number];
    distance: number;
  }[] = [];

  for (const obj of scene.objects) {
    if (obj.kind !== "planet" && obj.kind !== "star") continue;

    const d = vec.length(vec.sub(obj.position, refPos));
    bodies.push({ obj, distance: d });
  }

  // Sort so we render farthest first, nearest last.
  bodies.sort((a, b) => b.distance - a.distance);

  for (const { obj, distance } of bodies) {
    if (obj.kind !== "planet" && obj.kind !== "star") continue;

    const ndc = project(obj.position);
    if (!ndc) continue;

    const screenPoint = ndcToScreen(ndc, width, height);

    const name = displayNameForBodyId(obj.id);

    const dKm = distance / 1000;
    const distanceText = `d=${dKm.toFixed(0)} km`;

    const speedMps = vec.length(obj.velocity);
    const speedKmh = speedMps * 3.6;
    const speedText = `v=${speedKmh.toFixed(2)} km/h`;

    const lines = [name, distanceText, speedText];

    // Measure box size
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

    // Leader line
    ctx.strokeStyle = "white";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(boxX, boxY + boxHeight / 2);
    ctx.stroke();

    // Box background
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

    // Box border
    ctx.strokeStyle = "white";
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    // Text lines
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
  // Expecting ids like "planet:earth", "planet:sun"
  const parts = id.split(":");
  const raw = parts[parts.length - 1] || id;

  // Capitalize first letter
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
