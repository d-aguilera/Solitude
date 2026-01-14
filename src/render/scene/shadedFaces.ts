import type { ScreenPoint } from "../projection/projection.js";
import { projectCameraPoint } from "../projection/projection.js";
import { toRenderable } from "./renderPrep.js";
import type { SceneObject, SceneObjectWithCache } from "../../world/types.js";
import { vec } from "../../world/vec3.js";
import { mat3FromLocalFrame } from "../../world/localFrame.js";
import { mat3 } from "../../world/mat3.js";
import { E_SUN_AT_EARTH } from "../../world/solar/solarSystemConfig.js";
import { LocalFrame, PointLight, RGB, Vec3 } from "../../world/domain.js";

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
  lights: PointLight[];
  frameId: number;
}): FaceEntry[] {
  const {
    objects,
    cameraPos,
    cameraFrame,
    canvasWidth,
    canvasHeight,
    lights,
    frameId,
  } = params;
  const faceList: FaceEntry[] = [];

  objects.forEach((obj) => {
    if (obj.wireframeOnly) return;

    const { mesh, worldPoints, baseColor } = toRenderable(obj);
    const { faces, faceNormals } = mesh;

    // Prepare camera-space cache once per object & frame
    const cameraPoints = getCameraPointsForObject(
      obj,
      worldPoints,
      cameraPos,
      cameraFrame,
      frameId
    );

    const worldFaceNormals = getWorldFaceNormalsForObject(
      obj,
      faceNormals,
      frameId
    );

    for (let fi = 0; fi < faces.length; fi++) {
      const [i0, i1, i2] = faces[fi];
      const v0 = worldPoints[i0];
      const v1 = worldPoints[i1];
      const v2 = worldPoints[i2];

      let n: Vec3;

      if (worldFaceNormals) {
        // Use precomputed world-space face normal
        n = worldFaceNormals[fi];
      } else {
        // Fallback for meshes without precomputed normals (airplane)
        const e1 = vec.sub(v1, v0);
        const e2 = vec.sub(v2, v0);
        n = vec.normalize(vec.cross(e1, e2));
      }

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

      const isStar = obj.kind === "star";

      for (const [A, B, C] of clipped) {
        const p0 = projectCameraPoint(A, canvasWidth, canvasHeight);
        const p1 = projectCameraPoint(B, canvasWidth, canvasHeight);
        const p2 = projectCameraPoint(C, canvasWidth, canvasHeight);

        const d0 = p0.depth;
        const d1 = p1.depth;
        const d2 = p2.depth;
        const avgDepth = (d0 + d1 + d2) / 3;

        const intensity = isStar
          ? 1
          : toneMapIrradiance(computeIrradianceAtPoint(v0, n, lights));

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

function getWorldFaceNormalsForObject(
  obj: SceneObject,
  meshFaceNormals: Vec3[] | undefined,
  frameId: number
): Vec3[] | undefined {
  if (!meshFaceNormals) return undefined;

  const cachedObj = obj as SceneObjectWithCache;

  if (
    cachedObj.__worldFaceNormalsCache &&
    cachedObj.__faceNormalsFrameId === frameId
  ) {
    return cachedObj.__worldFaceNormalsCache;
  }

  const nFaces = meshFaceNormals.length;
  let cache = cachedObj.__worldFaceNormalsCache;
  if (!cache || cache.length !== nFaces) {
    cache = new Array<Vec3>(nFaces);
    for (let i = 0; i < nFaces; i++) {
      cache[i] = { x: 0, y: 0, z: 0 };
    }
    cachedObj.__worldFaceNormalsCache = cache;
  }

  const R = obj.orientation;
  const r00 = R[0][0],
    r01 = R[0][1],
    r02 = R[0][2];
  const r10 = R[1][0],
    r11 = R[1][1],
    r12 = R[1][2];
  const r20 = R[2][0],
    r21 = R[2][1],
    r22 = R[2][2];

  for (let i = 0; i < nFaces; i++) {
    const m = meshFaceNormals[i];
    const out = cache[i];
    const nx = m.x,
      ny = m.y,
      nz = m.z;

    out.x = r00 * nx + r01 * ny + r02 * nz;
    out.y = r10 * nx + r11 * ny + r12 * nz;
    out.z = r20 * nx + r21 * ny + r22 * nz;
  }

  cachedObj.__faceNormalsFrameId = frameId;
  return cache;
}

function computeIrradianceAtPoint(
  p: Vec3,
  n: Vec3,
  lights: PointLight[]
): number {
  if (lights.length === 0) return 0;

  let E = 0;

  // Very simple Lambertian irradiance from point lights:
  //   E = Σ (I / (4π r²)) * max(0, cosθ)
  // Here, I is luminosity-like (W or scaled W), r is distance in meters,
  // and n·L = cosθ is the Lambertian term.
  for (const light of lights) {
    const toLight = vec.sub(light.position, p);
    const r2 = vec.dot(toLight, toLight);
    if (r2 === 0) continue;

    const r = Math.sqrt(r2);
    const invR = 1 / r;
    const L = vec.scale(toLight, invR);
    const ndotl = vec.dot(n, L);
    if (ndotl <= 0) continue;

    const I = light.intensity; // luminosity-like
    const Ei = (I / (4 * Math.PI * r2)) * ndotl;
    E += Ei;
  }

  return E; // in arbitrary W/m^2-like units
}

// Simple exposure/tone-mapping constants.
const EXPOSURE = 10 / E_SUN_AT_EARTH;

function toneMapIrradiance(E: number): number {
  const hdr = EXPOSURE * E;
  const mapped = hdr / (1 + hdr); // Reinhard

  // Mild gamma to lift darks
  const gamma = 1.0 / 1.3;
  const ldr = Math.pow(mapped, gamma);

  return Math.max(0, Math.min(1, ldr));
}
