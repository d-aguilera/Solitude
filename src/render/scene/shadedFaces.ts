import type { ScreenPoint } from "../projection/projection.js";
import { toRenderable } from "./renderPrep.js";
import type {
  LocalFrame,
  RGB,
  SceneObject,
  SceneObjectWithCache,
  Vec3,
} from "../../world/types.js";
import { vec } from "../../world/vec3.js";
import { mat3FromLocalFrame } from "../../world/localFrame.js";
import { mat3 } from "../../world/mat3.js";
import { getFocalLengths } from "../../app/config.js";

/**
 * Internal representation of a single shaded triangle face ready for rasterization.
 */
export type FaceEntry = {
  intensity: number;
  depth: number;
  p0: ScreenPoint;
  p1: ScreenPoint;
  p2: ScreenPoint;
  baseColor: RGB;
};

/**
 * Build the list of shaded triangle faces (with depth and lighting information)
 * for all non-wireframe objects in the scene.
 */
export function buildShadedFaces(params: {
  objects: SceneObject[];
  cameraPos: Vec3;
  cameraFrame: LocalFrame;
  canvasWidth: number;
  canvasHeight: number;
  lightDir: Vec3;
  frameId: number;
}): FaceEntry[] {
  const {
    objects,
    cameraPos,
    cameraFrame,
    canvasWidth,
    canvasHeight,
    lightDir,
    frameId,
  } = params;
  const faceList: FaceEntry[] = [];

  objects.forEach((obj) => {
    if (obj.wireframeOnly) return;

    const { mesh, worldPoints, baseColor } = toRenderable(obj);
    const { faces } = mesh;

    // Prepare camera-space cache once per object & frame
    const cameraPoints = getCameraPointsForObject(
      obj,
      worldPoints,
      cameraPos,
      cameraFrame,
      frameId
    );

    for (let fi = 0; fi < faces.length; fi++) {
      const [i0, i1, i2] = faces[fi];
      const v0 = worldPoints[i0];
      const v1 = worldPoints[i1];
      const v2 = worldPoints[i2];

      // World-space normal for lighting & back-face culling
      const e1 = vec.sub(v1, v0);
      const e2 = vec.sub(v2, v0);
      const n = vec.normalize(vec.cross(e1, e2));

      if (obj.backFaceCulling) {
        const toCamera = vec.sub(cameraPos, v0);
        const facing = vec.dot(n, toCamera);
        if (facing <= 0) continue;
      }

      // Camera-space vertices
      const c0 = cameraPoints[i0];
      const c1 = cameraPoints[i1];
      const c2 = cameraPoints[i2];

      const clipped = clipTriangleAgainstNearPlaneCamera(c0, c1, c2);
      if (clipped.length === 0) continue;

      const intensity = Math.max(0, vec.dot(n, lightDir));

      for (const [A, B, C] of clipped) {
        const p0 = projectCameraPoint(A, canvasWidth, canvasHeight);
        const p1 = projectCameraPoint(B, canvasWidth, canvasHeight);
        const p2 = projectCameraPoint(C, canvasWidth, canvasHeight);

        const d0 = p0.depth ?? 0;
        const d1 = p1.depth ?? 0;
        const d2 = p2.depth ?? 0;
        const avgDepth = (d0 + d1 + d2) / 3;

        faceList.push({
          intensity,
          depth: avgDepth,
          p0,
          p1,
          p2,
          baseColor,
        });
      }
    }
  });

  return faceList;
}

// --- Camera-space helpers (mirroring projection.ts) ---

export const NEAR = 0.01;

function clipTriangleAgainstNearPlaneCamera(
  a: Vec3,
  b: Vec3,
  c: Vec3
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

export function projectCameraPoint(
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

// Object-level: ensure camera-space cache for this frame.
export function getCameraPointsForObject(
  obj: SceneObject,
  worldPoints: Vec3[],
  cameraPos: Vec3,
  cameraFrame: LocalFrame,
  frameId: number
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

  // world -> camera transform (same as worldPointToCameraPoint)
  const R_worldFromLocal = mat3FromLocalFrame(cameraFrame);
  const R_localFromWorld = mat3.transpose(R_worldFromLocal);

  for (let i = 0; i < n; i++) {
    const wp = worldPoints[i];
    const dx = wp.x - cameraPos.x;
    const dy = wp.y - cameraPos.y;
    const dz = wp.z - cameraPos.z;

    const out = cache[i];

    const r00 = R_localFromWorld[0][0],
      r01 = R_localFromWorld[0][1],
      r02 = R_localFromWorld[0][2];
    const r10 = R_localFromWorld[1][0],
      r11 = R_localFromWorld[1][1],
      r12 = R_localFromWorld[1][2];
    const r20 = R_localFromWorld[2][0],
      r21 = R_localFromWorld[2][1],
      r22 = R_localFromWorld[2][2];

    out.x = r00 * dx + r01 * dy + r02 * dz;
    out.y = r10 * dx + r11 * dy + r12 * dz;
    out.z = r20 * dx + r21 * dy + r22 * dz;
  }

  cachedObj.__cameraCacheFrameId = frameId;
  return cache;
}
