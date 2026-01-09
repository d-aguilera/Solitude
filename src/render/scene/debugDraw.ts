import type { Plane, Vec3 } from "../../world/types.js";
import { vec } from "../../world/vec3.js";

export type ProjectFn = (
  p: Vec3
) => { x: number; y: number; depth?: number } | null;

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

  ctx.save();
  ctx.lineWidth = 4;

  for (const seg of segments) {
    const pStart = project(seg.start);
    const pEnd = project(seg.end);
    if (!pStart || !pEnd) continue;

    ctx.strokeStyle = seg.color === "forward" ? "lime" : "red";
    ctx.beginPath();
    ctx.moveTo(pStart.x, pStart.y);
    ctx.lineTo(pEnd.x, pEnd.y);
    ctx.stroke();
  }

  ctx.restore();
}
