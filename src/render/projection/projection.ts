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

// Project a camera-space point that is known to be in front of NEAR.
function projectCameraPoint(
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
  if (depth < NEAR) return null;
  return projectCameraPoint(cameraPoint, canvasWidth, canvasHeight);
}

export function worldTriangleToScreenTriangles(
  v0: Vec3,
  v1: Vec3,
  v2: Vec3,
  cameraPosition: Vec3,
  cameraFrame: LocalFrame,
  canvasWidth: number,
  canvasHeight: number
): { p0: ScreenPoint; p1: ScreenPoint; p2: ScreenPoint }[] {
  // World -> camera
  const c0 = worldPointToCameraPoint(v0, cameraPosition, cameraFrame);
  const c1 = worldPointToCameraPoint(v1, cameraPosition, cameraFrame);
  const c2 = worldPointToCameraPoint(v2, cameraPosition, cameraFrame);

  // Clip in camera space
  const clipped = clipTriangleAgainstNearPlane(c0, c1, c2);
  if (clipped.length === 0) return [];

  // Project each resulting triangle
  const tris = [];
  for (const [A, B, C] of clipped) {
    tris.push({
      p0: projectCameraPoint(A, canvasWidth, canvasHeight),
      p1: projectCameraPoint(B, canvasWidth, canvasHeight),
      p2: projectCameraPoint(C, canvasWidth, canvasHeight),
    });
  }
  return tris;
}

const NEAR = 0.01; // camera-space forward threshold

// Clip a single triangle in camera space against y >= NEAR.
// Returns 0, 1, or 2 triangles, each as [Vec3, Vec3, Vec3] in camera space.
function clipTriangleAgainstNearPlane(
  a: Vec3,
  b: Vec3,
  c: Vec3
): [Vec3, Vec3, Vec3][] {
  const inside = (p: Vec3) => p.y >= NEAR;

  const pts = [a, b, c];
  const flags = pts.map(inside);
  const insideCount = flags.filter(Boolean).length;

  if (insideCount === 0) {
    return [];
  }

  // Helper: interpolate intersection with near plane on edge p->q
  const intersect = (p: Vec3, q: Vec3): Vec3 => {
    const t = (NEAR - p.y) / (q.y - p.y);
    return {
      x: p.x + t * (q.x - p.x),
      y: NEAR,
      z: p.z + t * (q.z - p.z),
    };
  };

  if (insideCount === 3) {
    // Entire triangle in front of near plane
    return [[a, b, c]];
  }

  // Re-label for readability
  const [A, B, C] = pts;
  const [inA, inB, inC] = flags;

  // Exactly one vertex inside → clipped triangle
  if (insideCount === 1) {
    const P = inA ? A : inB ? B : C; // inside
    const Q = inA ? B : inB ? C : A; // outside
    const R = inA ? C : inB ? A : B; // outside

    const IQ = intersect(P, Q);
    const IR = intersect(P, R);

    // Single new triangle
    return [[P, IQ, IR]];
  }

  // Exactly two vertices inside → clipped quad split into 2 triangles
  // One vertex is outside
  if (insideCount === 2) {
    const P = inA ? A : inB ? B : C; // inside
    const Q = inA && inB ? B : inB && inC ? C : A; // inside
    const R = !inA ? A : !inB ? B : C; // outside

    const IP = intersect(P, R);
    const IQ = intersect(Q, R);

    // Two triangles: (P, Q, IP) and (Q, IQ, IP)
    return [
      [P, Q, IP],
      [Q, IQ, IP],
    ];
  }

  return [];
}
