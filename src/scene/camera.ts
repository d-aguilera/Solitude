import { Vec3, LocalFrame } from "../domain/domainPorts.js";
import { mat3FromLocalFrame } from "../domain/localFrame.js";
import { mat3 } from "../domain/mat3.js";
import { SceneObject } from "../render/scenePorts.js";
import { SceneObjectWithCache } from "./sceneInternals.js";
import type { NdcPoint, ScreenPoint } from "../render/renderInternals.js";
import { vec3 } from "../domain/vec3.js";

// Camera-space forward threshold.
export const NEAR = 0.01;

// Vertical field of view in degrees.
const VERTICAL_FOV = 30;

/**
 * True if a camera-space point is in front of the near plane.
 */
export function isInFrontOfNearPlane(p: Vec3): boolean {
  return p.y >= NEAR;
}

/**
 * Pure: world-space -> camera-space for a single point.
 * This is the canonical world→camera transform used throughout the app.
 */
export function worldPointToCameraPoint(
  worldPoint: Vec3,
  cameraPos: Vec3,
  cameraFrame: LocalFrame,
): Vec3 {
  const R_worldFromLocal = mat3FromLocalFrame(cameraFrame);
  const R_localFromWorld = mat3.transpose(R_worldFromLocal);
  const dx = worldPoint.x - cameraPos.x;
  const dy = worldPoint.y - cameraPos.y;
  const dz = worldPoint.z - cameraPos.z;
  return {
    x:
      R_localFromWorld[0][0] * dx +
      R_localFromWorld[0][1] * dy +
      R_localFromWorld[0][2] * dz,
    y:
      R_localFromWorld[1][0] * dx +
      R_localFromWorld[1][1] * dy +
      R_localFromWorld[1][2] * dz,
    z:
      R_localFromWorld[2][0] * dx +
      R_localFromWorld[2][1] * dy +
      R_localFromWorld[2][2] * dz,
  };
}

export function getCameraPointsForObject(
  obj: SceneObject,
  worldPoints: Vec3[],
  cameraPos: Vec3,
  cameraFrame: LocalFrame,
  frameId: number,
): Vec3[] {
  const cachedObj = obj as SceneObjectWithCache;

  if (
    cachedObj.__cameraCacheFrameId === frameId &&
    cachedObj.__cameraPointsCache
  ) {
    return cachedObj.__cameraPointsCache;
  }

  const n = worldPoints.length;
  let cache = cachedObj.__cameraPointsCache;

  if (!cache || cache.length !== n) {
    cache = new Array<Vec3>(n);
    for (let i = 0; i < n; i++) {
      cache[i] = { x: 0, y: 0, z: 0 };
    }
    cachedObj.__cameraPointsCache = cache;
  }

  // world -> camera transform (canonical, via helper)
  for (let i = 0; i < n; i++) {
    const wp = worldPoints[i];
    const cp = worldPointToCameraPoint(wp, cameraPos, cameraFrame);
    const out = cache[i];
    out.x = cp.x;
    out.y = cp.y;
    out.z = cp.z;
  }

  cachedObj.__cameraCacheFrameId = frameId;
  return cache;
}

export function clipTriangleAgainstNearPlaneCamera(
  a: Vec3,
  b: Vec3,
  c: Vec3,
): [Vec3, Vec3, Vec3][] {
  const inside = (p: Vec3) => p.y >= NEAR;

  const pts = [a, b, c];
  const flags = pts.map(inside);
  const insideCount = flags.filter(Boolean).length;

  if (insideCount === 0) return [];

  const intersect = (p: Vec3, q: Vec3): Vec3 => {
    const t = (NEAR - p.y) / (q.y - p.y);
    return {
      x: p.x + t * (q.x - p.x),
      y: NEAR,
      z: p.z + t * (q.z - p.z),
    };
  };

  if (insideCount === 3) return [[a, b, c]];

  const [A, B, C] = pts;
  const [inA, inB, inC] = flags;

  if (insideCount === 1) {
    const P = inA ? A : inB ? B : C;
    const Q = inA ? B : inB ? C : A;
    const R = inA ? C : inB ? A : B;

    const IQ = intersect(P, Q);
    const IR = intersect(P, R);

    return [[P, IQ, IR]];
  }

  // insideCount === 2
  const P = inA ? A : inB ? B : C;
  const Q = inA && inB ? B : inB && inC ? C : A;
  const R = !inA ? A : !inB ? B : C;

  const IP = intersect(P, R);
  const IQ = intersect(Q, R);

  return [
    [P, Q, IP],
    [Q, IQ, IP],
  ];
}

/**
 * Compute focal lengths (fX, fY) for our camera.
 *
 * The camera is parameterized in terms of a vertical field of view
 * and a “circle condition” so that a sphere centered on the view axis
 * appears circular in screen space, even when canvasWidth != canvasHeight.
 */
function getFocalLengths(
  canvasWidth: number,
  canvasHeight: number,
): { fX: number; fY: number } {
  const vFovRad = (VERTICAL_FOV * Math.PI) / 180;

  // Vertical focal length from chosen vertical FOV:
  const fY = 1 / Math.tan(vFovRad / 2);

  // Enforce circle condition: fX * W == fY * H
  const fX = fY * (canvasHeight / canvasWidth);

  return { fX, fY };
}

/**
 * Core projection from camera space -> NDC (no canvas size baked in).
 */
export function projectCameraPointToNdc(
  cameraPoint: Vec3,
  canvasWidth: number,
  canvasHeight: number,
): NdcPoint {
  const { fX, fY } = getFocalLengths(canvasWidth, canvasHeight);
  const depth = cameraPoint.y;

  const scaled = vec3.scale(
    { x: cameraPoint.x * fX, y: cameraPoint.z * fY, z: 0 },
    1 / depth,
  );

  return {
    x: scaled.x,
    y: scaled.y,
    depth,
  };
}

/**
 * Full world-space -> NDC projection with near-plane rejection.
 *
 * Returns null when the point lies behind the near plane in camera space.
 */
export function projectWorldPointToNdc(
  worldPoint: Vec3,
  cameraPos: Vec3,
  cameraFrame: LocalFrame,
  canvasWidth: number,
  canvasHeight: number,
): NdcPoint | null {
  const cameraPoint = worldPointToCameraPoint(
    worldPoint,
    cameraPos,
    cameraFrame,
  );
  if (!isInFrontOfNearPlane(cameraPoint)) return null;
  return projectCameraPointToNdc(cameraPoint, canvasWidth, canvasHeight);
}

/**
 * Map NDC coordinates into pixel space for a given canvas.
 */
export function ndcToScreen(
  ndc: NdcPoint,
  canvasWidth: number,
  canvasHeight: number,
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
  canvasHeight: number,
): ScreenPoint {
  const ndc = projectCameraPointToNdc(cameraPoint, canvasWidth, canvasHeight);
  return ndcToScreen(ndc, canvasWidth, canvasHeight);
}
