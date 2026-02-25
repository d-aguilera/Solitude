import type { DomainCameraPose } from "../app/appPorts.js";
import type { Mat3, Vec3 } from "../domain/domainPorts.js";
import { localFrame } from "../domain/localFrame.js";
import { mat3 } from "../domain/mat3.js";
import { vec3 } from "../domain/vec3.js";
import { alloc } from "../global/allocProfiler.js";
import { ndcToScreenInto, ndcZero } from "./ndc.js";
import type { ProjectedSegment } from "./renderInternals.js";
import type { NdcPoint } from "./renderPorts.js";

/**
 * Camera-space forward threshold.
 */
const NEAR = 0.01;

/**
 * Vertical field of view in degrees.
 * The camera is parameterized in terms of a vertical field of view
 * and a “circle condition” so that a sphere centered on the view axis
 * appears circular in screen space, even when canvasWidth != canvasHeight.
 */
const VERTICAL_FOV = 30;
const vFovRad = (VERTICAL_FOV * Math.PI) / 180;
const focalLengthY = 1 / Math.tan(vFovRad / 2);

/**
 * Global pool of camera-space points reused across all ProjectionService instances.
 * Grows on demand but never shrinks; growth allocs are paid once, not per frame.
 */
const GLOBAL_CAMERA_POINT_POOL: Vec3[] = [];

/**
 * Ensure the global camera-point pool can hold at least `n` Vec3s.
 * Allocations are accounted via alloc.vec3 and only happen when capacity grows.
 */
function ensureGlobalCameraPointPoolCapacity(n: number): void {
  const length = GLOBAL_CAMERA_POINT_POOL.length;
  if (length >= n) return;

  GLOBAL_CAMERA_POINT_POOL.length = n;

  alloc.withName(ensureGlobalCameraPointPoolCapacity.name, () => {
    for (let i = length; i < n; i++) {
      GLOBAL_CAMERA_POINT_POOL[i] = vec3.zero();
    }
  });
}

// scratch
const deltaScratch: Vec3 = vec3.zero();
const cameraPointScratch: Vec3 = vec3.zero();

let A = vec3.zero();
let B = vec3.zero();
let C = vec3.zero();
let P = vec3.zero();
let Q = vec3.zero();
let R = vec3.zero();
let IQ = vec3.zero();
let IR = vec3.zero();
let Pin1 = vec3.zero();
let Pin2 = vec3.zero();
let Pout = vec3.zero();
let IP1 = vec3.zero();
let IP2 = vec3.zero();

const aCamScratch: Vec3 = vec3.zero();
const bCamScratch: Vec3 = vec3.zero();

const intersectScratch: Vec3 = vec3.zero();

const ndcAScratch: NdcPoint = ndcZero();
const ndcBScratch: NdcPoint = ndcZero();
const ndcIScratch: NdcPoint = ndcZero();

/**
 * Projection service responsible for:
 *  - Transforming world-space positions into camera space
 *  - Clipping against the near plane
 *  - Mapping camera-space positions into NDC
 *
 * The service is parameterized by a camera pose and canvas size.
 */
export class ProjectionService {
  private readonly focalLengthX: number;

  // Precomputed camera transform helpers for segment/point projection.
  private readonly R_localFromWorld: Mat3;
  private readonly cameraPosition: Vec3;

  constructor(
    pose: DomainCameraPose,
    canvasWidth: number,
    canvasHeight: number,
  ) {
    this.focalLengthX = focalLengthY * (canvasHeight / canvasWidth);

    this.R_localFromWorld = mat3.zero();
    localFrame.intoMat3(this.R_localFromWorld, pose.frame);
    mat3.transposeInto(this.R_localFromWorld, this.R_localFromWorld);

    this.cameraPosition = pose.position;
  }

  /**
   * Full world-space -> NDC projection with near-plane rejection.
   *
   * Returns null when the point lies behind the near plane in camera space.
   */
  projectWorldPointToNdcInto(into: NdcPoint, worldPoint: Vec3): boolean {
    this.worldPointToCameraPointNoClipInto(cameraPointScratch, worldPoint);
    if (!this.isInFrontOfNearPlane(cameraPointScratch)) {
      return false;
    }
    this.projectCameraPointToNdcInto(into, cameraPointScratch);
    return true;
  }

  worldPointsToCameraPointsNoClip(worldPoints: Vec3[]): Vec3[] {
    return alloc.withName(this.worldPointsToCameraPointsNoClip.name, () => {
      const n = worldPoints.length;

      // 1) Ensure the global pool is large enough (allocates only when it grows).
      ensureGlobalCameraPointPoolCapacity(n);

      // 2) Use the first n entries from the global pool as our scratch array.
      const R_localFromWorld = this.R_localFromWorld;
      const position = this.cameraPosition;

      for (let i = 0; i < n; i++) {
        // delta = worldPoint - cameraPosition
        vec3.subInto(deltaScratch, worldPoints[i], position);

        // cameraPoints[i] = R_localFromWorld * delta
        mat3.mulVec3Into(
          GLOBAL_CAMERA_POINT_POOL[i],
          R_localFromWorld,
          deltaScratch,
        );
      }

      // Callers must treat only the first n elements as valid for this call.
      return GLOBAL_CAMERA_POINT_POOL;
    });
  }

  /**
   * World-space -> camera-space for a single point, without clipping.
   */
  private worldPointToCameraPointNoClipInto(
    into: Vec3,
    worldPoint: Vec3,
  ): void {
    // delta = worldPoint - cameraPosition
    vec3.subInto(deltaScratch, worldPoint, this.cameraPosition);

    // into (cameraPoint) = R_localFromWorld * delta
    mat3.mulVec3Into(into, this.R_localFromWorld, deltaScratch);
  }

  /**
   * Core projection from camera space -> NDC using this service's
   * canvas‑specific focal lengths.
   */
  projectCameraPointToNdcInto(into: NdcPoint, cameraPoint: Vec3): void {
    const depth = cameraPoint.y;
    into.x = (cameraPoint.x * this.focalLengthX) / depth;
    into.y = (cameraPoint.z * focalLengthY) / depth;
    into.depth = depth;
  }

  /**
   * Clip a triangle in camera space against the near plane.
   *
   * Returns 0, 1, or 2 triangles in camera space after clipping.
   *
   * The returned Vec3s reference internal scratch storage that is only
   * stable until the next call to this method. Callers must consume
   * the result immediately.
   */

  clipTriangleAgainstNearPlaneCamera(
    into: [[Vec3, Vec3, Vec3], [Vec3, Vec3, Vec3]],
    a: Vec3,
    b: Vec3,
    c: Vec3,
  ): number {
    const inA = this.isInFrontOfNearPlane(a);
    const inB = this.isInFrontOfNearPlane(b);
    const inC = this.isInFrontOfNearPlane(c);
    const insideCount = (inA ? 1 : 0) + (inB ? 1 : 0) + (inC ? 1 : 0);

    // None inside: return empty array.
    if (insideCount === 0) return 0;

    // All inside: return input references.
    if (insideCount === 3) {
      [A, B, C] = into[0];
      vec3.copyInto(A, a);
      vec3.copyInto(B, b);
      vec3.copyInto(C, c);
      return 1;
    }

    // One inside: return a single clipped triangle.
    if (insideCount === 1) {
      // P inside; Q, R outside.
      if (inA) {
        P = a;
        Q = b;
        R = c;
      } else if (inB) {
        P = b;
        Q = c;
        R = a;
      } else {
        P = c;
        Q = a;
        R = b;
      }

      this.intersectInto(IQ, P, Q);
      this.intersectInto(IR, P, R);

      const [A, B, C] = into[0];
      vec3.copyInto(A, P);
      vec3.copyInto(B, IQ);
      vec3.copyInto(C, IR);

      return 1;
    }

    // insideCount === 2
    // Two inside, one outside: result is two triangles.
    // Pin1, Pin2 inside; Pout outside.
    if (!inA) {
      Pout = a;
      Pin1 = b;
      Pin2 = c;
    } else if (!inB) {
      Pout = b;
      Pin1 = c;
      Pin2 = a;
    } else {
      Pout = c;
      Pin1 = a;
      Pin2 = b;
    }

    this.intersectInto(IP1, Pin1, Pout);
    this.intersectInto(IP2, Pin2, Pout);

    // Triangle 1: Pin1, Pin2, IP1
    [A, B, C] = into[0];
    vec3.copyInto(A, Pin1);
    vec3.copyInto(B, Pin2);
    vec3.copyInto(C, IP1);

    // Triangle 2: Pin2, IP2, IP1
    [A, B, C] = into[1];
    vec3.copyInto(A, Pin2);
    vec3.copyInto(B, IP2);
    vec3.copyInto(C, IP1);

    return 2;
  }

  /**
   * Project a world-space segment [A, B] to one or more screen-space
   * polylines, clipping against the near plane.
   * It returns `false` if the segment is fully behind the near plane.
   * Otherwise, it returns `true` and sets `into` as following:
   *   { A', B', false } if both A and B are front of the near plane.
   * If either A or B is not in front of the near plane, then I is the
   * intersection point between the segment and the near plane and the
   * function returns `true` and sets `into` as follows:
   *   { A', I,  true  } if A in front of the near plane
   *   { I,  B', true  } if B in front of the near plane
   */
  projectWorldSegmentToScreenInto(
    into: ProjectedSegment,
    aWorld: Vec3,
    bWorld: Vec3,
    screenWidth: number,
    screenHeight: number,
  ): boolean {
    // 1) World -> camera space
    this.worldPointToCameraPointNoClipInto(aCamScratch, aWorld);
    this.worldPointToCameraPointNoClipInto(bCamScratch, bWorld);

    const inA = this.isInFrontOfNearPlane(aCamScratch);
    const inB = this.isInFrontOfNearPlane(bCamScratch);

    // Both behind near plane: discard
    if (!inA && !inB) {
      return false;
    }

    // Both in front of near plane: project as-is
    if (inA && inB) {
      this.projectCameraPointToNdcInto(ndcAScratch, aCamScratch);
      this.projectCameraPointToNdcInto(ndcBScratch, bCamScratch);
      ndcToScreenInto(into.a, ndcAScratch, screenWidth, screenHeight);
      ndcToScreenInto(into.b, ndcBScratch, screenWidth, screenHeight);
      into.clipped = false;
      return true;
    }

    // this section (clipped = true) produces rasterization anomalies

    this.intersectInto(intersectScratch, aCamScratch, bCamScratch);
    this.projectCameraPointToNdcInto(ndcIScratch, intersectScratch);

    if (inA) {
      // A inside, B outside => return { a, i }
      this.projectCameraPointToNdcInto(ndcAScratch, aCamScratch);
      ndcToScreenInto(into.a, ndcAScratch, screenWidth, screenHeight);
      ndcToScreenInto(into.b, ndcIScratch, screenWidth, screenHeight);
    } else {
      // B inside, A outside => return { i, b }
      this.projectCameraPointToNdcInto(ndcBScratch, bCamScratch);
      ndcToScreenInto(into.a, ndcIScratch, screenWidth, screenHeight);
      ndcToScreenInto(into.b, ndcBScratch, screenWidth, screenHeight);
    }

    into.clipped = true;
    return true;
  }

  /**
   * Intersect segment [p,q] with plane y = NEAR, writing into dst.
   */
  private intersectInto = (dst: Vec3, p: Vec3, q: Vec3): void => {
    const t = (NEAR - p.y) / (q.y - p.y);
    vec3.lerpInto(dst, p, q, t);
    dst.y = NEAR; // clamp to avoid floating point drift
  };

  /**
   * True if a camera-space point is in front of the near plane.
   */
  private isInFrontOfNearPlane(p: Vec3): boolean {
    return p.y >= NEAR;
  }
}
