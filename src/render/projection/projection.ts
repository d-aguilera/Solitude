import { getFocalLengths } from "../../app/config.js";
import { mat3FromLocalFrame } from "../../world/localFrame.js";
import type { LocalFrame, Vec3 } from "../../world/types.js";
import { mat3 } from "../../world/mat3.js";
import { vec } from "../../world/vec3.js";

export interface ScreenPoint {
  x: number;
  y: number;
  depth: number; // camera-space depth (positive means in front of camera)
}

/**
 * Normalized device coordinate in the projection plane:
 *   - x, y in [-1, 1] after perspective divide
 *   - depth is camera-space Y (forward distance)
 *
 * Mapping to pixel coordinates is done separately via `ndcToScreen`.
 */
export interface NdcPoint {
  x: number;
  y: number;
  depth: number;
}

export interface TopViewContext {
  cameraPosition: Vec3;
  cameraFrame: LocalFrame;
  canvasWidth: number;
  canvasHeight: number;
}

export interface PilotViewContext extends TopViewContext {
  pilotAzimuth: number;
  pilotElevation: number;
}

const NEAR = 0.01; // camera-space forward threshold

/**
 * Pure: world-space -> camera-space.
 */
export function worldPointToCameraPoint(
  worldPoint: Vec3,
  cameraPosition: Vec3,
  cameraFrame: LocalFrame
): Vec3 {
  const R_worldFromLocal = mat3FromLocalFrame(cameraFrame);
  const R_localFromWorld = mat3.transpose(R_worldFromLocal);
  const d = vec.sub(worldPoint, cameraPosition);
  return mat3.mulVec3(R_localFromWorld, d);
}

/**
 * In-place look adjustment in camera space for pilot view.
 */
export function applyPilotLook(
  cameraPoint: Vec3,
  azimuth: number,
  elevation: number
): void {
  if (azimuth === 0 && elevation === 0) {
    return;
  }

  if (azimuth !== 0) {
    const r = rotate2D(cameraPoint.x, cameraPoint.y, -azimuth);
    cameraPoint.x = r.a;
    cameraPoint.y = r.b;
  }

  if (elevation !== 0) {
    const r = rotate2D(cameraPoint.y, cameraPoint.z, -elevation);
    cameraPoint.y = r.a;
    cameraPoint.z = r.b;
  }
}

/**
 * Core projection from camera space -> NDC (no canvas size baked in).
 */
export function projectCameraPointToNdc(
  cameraPoint: Vec3,
  canvasWidth: number,
  canvasHeight: number
): NdcPoint {
  const { fX, fY } = getFocalLengths(canvasWidth, canvasHeight);
  const depth = cameraPoint.y;

  const scaled = vec.scale(
    { x: cameraPoint.x * fX, y: cameraPoint.z * fY, z: 0 },
    1 / depth
  );

  return {
    x: scaled.x,
    y: scaled.y,
    depth,
  };
}

/**
 * Map NDC coordinates into pixel space for a given canvas.
 */
export function ndcToScreen(
  ndc: NdcPoint,
  canvasWidth: number,
  canvasHeight: number
): ScreenPoint {
  return {
    x: (ndc.x + 1) * 0.5 * canvasWidth,
    y: (1 - ndc.y) * 0.5 * canvasHeight,
    depth: ndc.depth,
  };
}

/**
 * Convenience: project a camera-space point that is known to be in front of NEAR,
 * returning pixel coordinates for a specific canvas.
 */
export function projectCameraPoint(
  cameraPoint: Vec3,
  canvasWidth: number,
  canvasHeight: number
): ScreenPoint {
  const ndc = projectCameraPointToNdc(cameraPoint, canvasWidth, canvasHeight);
  return ndcToScreen(ndc, canvasWidth, canvasHeight);
}

/**
 * Convenience: full world->screen projection for pilot view.
 * Used by callers that want a ready-made closure for a specific camera + canvas.
 */
export function makePilotView(ctx: PilotViewContext) {
  const { canvasWidth, canvasHeight } = ctx;

  return function pilotView(worldPoint: Vec3): ScreenPoint | null {
    const cameraPoint = worldPointToCameraPoint(
      worldPoint,
      ctx.cameraPosition,
      ctx.cameraFrame
    );

    applyPilotLook(cameraPoint, ctx.pilotAzimuth, ctx.pilotElevation);

    const depth = cameraPoint.y;
    if (depth < NEAR) return null;

    return projectCameraPoint(cameraPoint, canvasWidth, canvasHeight);
  };
}

/**
 * Convenience: full world->screen projection for a top-down view.
 */
export function makeTopView(ctx: TopViewContext) {
  const { canvasWidth, canvasHeight } = ctx;

  return function topView(worldPoint: Vec3): ScreenPoint | null {
    const cameraPoint = worldPointToCameraPoint(
      worldPoint,
      ctx.cameraPosition,
      ctx.cameraFrame
    );

    const depth = cameraPoint.y;
    if (depth < NEAR) return null;

    return projectCameraPoint(cameraPoint, canvasWidth, canvasHeight);
  };
}

function rotate2D(
  a: number,
  b: number,
  angle: number
): { a: number; b: number } {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  return {
    a: a * c - b * s,
    b: a * s + b * c,
  };
}
