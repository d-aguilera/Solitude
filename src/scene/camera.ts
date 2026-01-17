import { Vec3, LocalFrame } from "../domain/domainPorts.js";
import { mat3FromLocalFrame } from "../domain/localFrame.js";
import { mat3 } from "../domain/mat3.js";
import { SceneObject } from "../render/scenePorts.js";
import { SceneObjectWithCache } from "./sceneInternals.js";

export const NEAR = 0.01;

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
