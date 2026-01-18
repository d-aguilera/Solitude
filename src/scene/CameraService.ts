import type { SceneObject } from "../appScene/appScenePorts.js";
import type { Vec3, LocalFrame } from "../domain/domainPorts.js";
import { mat3FromLocalFrame } from "../domain/localFrame.js";
import { mat3 } from "../domain/mat3.js";
import type { SceneObjectWithCache } from "./sceneInternals.js";
import type { Camera } from "./scenePorts.js";

/**
 * Camera-space forward threshold.
 */
const NEAR = 0.01;

/**
 * Camera-space transformation and clipping helper.
 *
 * Responsibilities kept here:
 *  - Transforming world-space points into camera space for a given pose
 *  - Maintaining per-object, per-frame camera-space caches
 *  - Clipping camera-space triangles against the near plane
 */
export class CameraService {
  private readonly cameraPos: Vec3;
  private readonly cameraFrame: LocalFrame;
  private readonly frameId: number;

  constructor(camera: Camera, frameId: number) {
    this.cameraPos = camera.position;
    this.cameraFrame = camera.frame;
    this.frameId = frameId;
  }

  /**
   * Convert an object's world-space points into camera space,
   * using a per-object cache keyed by the current frame id.
   */
  getCameraPointsForObject(obj: SceneObject, worldPoints: Vec3[]): Vec3[] {
    const cachedObj = obj as SceneObjectWithCache;

    if (
      cachedObj.__cameraCacheFrameId === this.frameId &&
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

    // world -> camera transform for each point
    for (let i = 0; i < n; i++) {
      const wp = worldPoints[i];
      const cp = this.worldPointToCameraPointNoClip(wp);
      const out = cache[i];
      out.x = cp.x;
      out.y = cp.y;
      out.z = cp.z;
    }

    cachedObj.__cameraCacheFrameId = this.frameId;
    return cache;
  }

  /**
   * Clip a triangle in camera space against the near plane.
   *
   * Returns 0, 1, or 2 triangles in camera space after clipping.
   */
  clipTriangleAgainstNearPlaneCamera(
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
   * World-space -> camera-space for a single point, without near-plane checks.
   */
  worldPointToCameraPointNoClip(worldPoint: Vec3): Vec3 {
    const cameraPos = this.cameraPos;
    const cameraFrame = this.cameraFrame;

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
}
