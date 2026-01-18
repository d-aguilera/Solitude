import type { SceneObject } from "../appScene/appScenePorts.js";
import type { Vec3, LocalFrame } from "../domain/domainPorts.js";
import { mat3FromLocalFrame } from "../domain/localFrame.js";
import { mat3 } from "../domain/mat3.js";
import { vec3 } from "../domain/vec3.js";
import type { NdcPoint } from "./scenePorts.js";
import type { SceneObjectWithCache } from "./sceneInternals.js";

// Camera-space forward threshold.
const NEAR = 0.01;

// Vertical field of view in degrees.
const VERTICAL_FOV = 30;

/**
 * Canonical camera representation used throughout world/scene transforms.
 */
export interface Camera {
  position: Vec3;
  frame: LocalFrame;
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
    const cp = worldPointToCameraPointNoClip(wp, cameraPos, cameraFrame);
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
 * Core projection from camera space -> NDC, parameterized by
 * canvas dimensions via focal lengths.
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
 * World-space -> camera-space for a single point.
 */
export function worldPointToCameraPoint(
  worldPoint: Vec3,
  cameraPos: Vec3,
  cameraFrame: LocalFrame,
): Vec3 | null {
  const cameraPoint = worldPointToCameraPointNoClip(
    worldPoint,
    cameraPos,
    cameraFrame,
  );
  return isInFrontOfNearPlane(cameraPoint) ? cameraPoint : null;
}

function worldPointToCameraPointNoClip(
  worldPoint: Vec3,
  cameraPos: Vec3,
  cameraFrame: LocalFrame,
): Vec3 {
  const R_worldFromLocal = mat3FromLocalFrame(cameraFrame);
  const R_localFromWorld = mat3.transpose(R_worldFromLocal);
  const dx = worldPoint.x - cameraPos.x;
  const dy = worldPoint.y - cameraPos.y;
  const dz = worldPoint.z - cameraPos.z;
  const cameraPoint: Vec3 = {
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
  return cameraPoint;
}

/**
 * Compute focal lengths (fX, fY) for a perspective projection.
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
 * True if a camera-space point is in front of the near plane.
 */
function isInFrontOfNearPlane(p: Vec3): boolean {
  return p.y >= NEAR;
}
