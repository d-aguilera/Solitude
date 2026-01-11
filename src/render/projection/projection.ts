import { getFocalLengths } from "../../app/config.js";
import { mat3FromLocalFrame } from "../../world/localFrame.js";
import type { LocalFrame, Vec3 } from "../../world/types.js";
import { mat3 } from "../../world/mat3.js";
import { vec } from "../../world/vec3.js";

export interface ScreenPoint {
  x: number;
  y: number;
  depth?: number; // camera-space depth (positive means in front of camera)
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

export function makePilotView(ctx: PilotViewContext) {
  const { canvasWidth, canvasHeight } = ctx;

  return function pilotView(worldPoint: Vec3): ScreenPoint | null {
    const cameraPoint = worldPointToCameraPoint(
      worldPoint,
      ctx.cameraPosition,
      ctx.cameraFrame
    );

    applyPilotLook(cameraPoint, ctx.pilotAzimuth, ctx.pilotElevation);

    return projectIfInFront(cameraPoint, canvasWidth, canvasHeight);
  };
}

export function makeTopView(ctx: TopViewContext) {
  const { canvasWidth, canvasHeight } = ctx;

  return function topView(worldPoint: Vec3): ScreenPoint | null {
    const cameraPoint = worldPointToCameraPoint(
      worldPoint,
      ctx.cameraPosition,
      ctx.cameraFrame
    );

    return projectIfInFront(cameraPoint, canvasWidth, canvasHeight);
  };
}

// Translate world point into camera-relative coordinates
function worldPointToCameraPoint(
  worldPoint: Vec3,
  cameraPosition: Vec3,
  cameraFrame: LocalFrame
): Vec3 {
  // R_worldFromLocal: columns = camera's local basis vectors in world space
  const R_worldFromLocal = mat3FromLocalFrame(cameraFrame);

  // For pure rotations, inverse = transpose (R_localFromWorld)
  const R_localFromWorld = mat3.transpose(R_worldFromLocal);

  const d = vec.sub(worldPoint, cameraPosition);

  // Interpreted as a world-space column vector, map to camera/local space.
  return mat3.mulVec3(R_localFromWorld, d);
}

function applyPilotLook(cameraPoint: Vec3, azimuth: number, elevation: number) {
  if (azimuth === 0 && elevation === 0) {
    return;
  }

  // Azimuth: yaw around up axis -> rotate (right, forward) = (x,y)
  if (azimuth !== 0) {
    const r = rotate2D(cameraPoint.x, cameraPoint.y, -azimuth);
    cameraPoint.x = r.a; // right
    cameraPoint.y = r.b; // forward
  }

  // Elevation: pitch around right axis -> rotate (forward, up) = (y,z)
  if (elevation !== 0) {
    const r = rotate2D(cameraPoint.y, cameraPoint.z, -elevation);
    cameraPoint.y = r.a; // forward
    cameraPoint.z = r.b; // up
  }
}

function applyPerspective(
  cameraPoint: Vec3,
  canvasWidth: number,
  canvasHeight: number
): ScreenPoint {
  const { fX, fY } = getFocalLengths(canvasWidth, canvasHeight);
  const depth = cameraPoint.y;

  const scaled = vec.scale(
    { x: cameraPoint.x * fX, y: cameraPoint.z * fY, z: 0 },
    1 / depth
  );

  const { x: ndcX, y: ndcY } = scaled;

  return {
    x: (ndcX + 1) * 0.5 * canvasWidth,
    y: (1 - ndcY) * 0.5 * canvasHeight,
    depth,
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

function projectIfInFront(
  cameraPoint: Vec3,
  canvasWidth: number,
  canvasHeight: number
): ScreenPoint | null {
  const depth = cameraPoint.y;
  if (depth <= 0.1) return null;
  return applyPerspective(cameraPoint, canvasWidth, canvasHeight);
}
