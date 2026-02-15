import type { DomainCameraPose } from "../app/appPorts.js";
import type { Mat3, Vec3 } from "../domain/domainPorts.js";
import { localFrame } from "../domain/localFrame.js";
import { mat3 } from "../domain/mat3.js";
import { vec3 } from "../domain/vec3.js";
import { alloc } from "../global/allocProfiler.js";
import { ndcToScreen } from "./ndcToScreen.js";
import type { ProjectedSegment } from "./renderInternals.js";
import type { NdcPoint } from "./renderPorts.js";

/**
 * Camera-space forward threshold.
 */
const NEAR = 0.01;

/**
 * Vertical field of view in degrees.
 */
const VERTICAL_FOV = 30;

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

const deltaScratch: Vec3 = vec3.zero();
const cameraPointScratch: Vec3 = vec3.zero();

// --- begin new scratch state for triangle clipping ---
const triScratch: Vec3[] = [
  vec3.zero(), // 0
  vec3.zero(), // 1
  vec3.zero(), // 2
  vec3.zero(), // 3
  vec3.zero(), // 4
  vec3.zero(), // 5
];

const triOut0: [Vec3, Vec3, Vec3] = [
  triScratch[0],
  triScratch[1],
  triScratch[2],
];

const triOut1: [Vec3, Vec3, Vec3] = [
  triScratch[3],
  triScratch[4],
  triScratch[5],
];
// --- end new scratch state for triangle clipping ---

const aCamScratch: Vec3 = vec3.zero();
const bCamScratch: Vec3 = vec3.zero();

const R_worldFromLocalScratch: Mat3 = mat3.zero();

const intersectScratch: Vec3 = vec3.zero();

const ndcAScratch: NdcPoint = { x: 0, y: 0, depth: 0 };
const ndcBScratch: NdcPoint = { x: 0, y: 0, depth: 0 };
const ndcIScratch: NdcPoint = { x: 0, y: 0, depth: 0 };

/**
 * Projection service responsible for:
 *  - Transforming world-space positions into camera space
 *  - Clipping against the near plane
 *  - Mapping camera-space positions into NDC
 *
 * The service is parameterized by a camera pose and canvas size.
 */
export class ProjectionService {
  private readonly fX: number;
  private readonly fY: number;

  // Precomputed camera transform helpers for segment/point projection.
  private readonly R_localFromWorld: Mat3;
  private readonly cameraPosition: Vec3;

  constructor(
    pose: DomainCameraPose,
    canvasWidth: number,
    canvasHeight: number,
  ) {
    const { fX, fY, R_localFromWorld } = alloc.withName(
      ProjectionService.name + ":ctor",
      () => {
        const { fX, fY } = this.getFocalLengths(canvasWidth, canvasHeight);

        localFrame.intoMat3(R_worldFromLocalScratch, pose.frame);
        const R_localFromWorld = mat3.transposeInto(
          mat3.zero(),
          R_worldFromLocalScratch,
        );

        return { fX, fY, R_localFromWorld };
      },
    );

    this.fX = fX;
    this.fY = fY;
    this.R_localFromWorld = R_localFromWorld;
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
    into.x = (cameraPoint.x * this.fX) / depth;
    into.y = (cameraPoint.z * this.fY) / depth;
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
    a: Vec3,
    b: Vec3,
    c: Vec3,
  ): [Vec3, Vec3, Vec3][] {
    const inside = (p: Vec3) => p.y >= NEAR;

    const inA = inside(a);
    const inB = inside(b);
    const inC = inside(c);
    const insideCount = (inA ? 1 : 0) + (inB ? 1 : 0) + (inC ? 1 : 0);

    if (insideCount === 0) return [];

    // Helper: intersect segment [p,q] with plane y = NEAR, writing into dst.
    const intersectInto = (dst: Vec3, p: Vec3, q: Vec3): void => {
      const t = (NEAR - p.y) / (q.y - p.y);
      dst.x = p.x + t * (q.x - p.x);
      dst.y = NEAR;
      dst.z = p.z + t * (q.z - p.z);
    };

    if (insideCount === 3) {
      // All inside: just reuse input references.
      // We still go through triOut0 so the caller always uses the same shape.
      triOut0[0] = a;
      triOut0[1] = b;
      triOut0[2] = c;
      return [triOut0];
    }

    if (insideCount === 1) {
      // One inside: result is a single clipped triangle.
      // Pick the inside vertex P and the two outside vertices Q,R.
      let P: Vec3, Q: Vec3, R: Vec3;
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

      const IQ = triScratch[0];
      const IR = triScratch[1];
      intersectInto(IQ, P, Q);
      intersectInto(IR, P, R);

      triOut0[0] = P;
      triOut0[1] = IQ;
      triOut0[2] = IR;
      return [triOut0];
    }

    // insideCount === 2
    // Two inside, one outside: result is two triangles.
    let Pin1: Vec3, Pin2: Vec3, Pout: Vec3;
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

    const IP1 = triScratch[2];
    const IP2 = triScratch[3];
    intersectInto(IP1, Pin1, Pout);
    intersectInto(IP2, Pin2, Pout);

    // Triangle 1: Pin1, Pin2, IP1
    triOut0[0] = Pin1;
    triOut0[1] = Pin2;
    triOut0[2] = IP1;

    // Triangle 2: Pin2, IP2, IP1
    triOut1[0] = Pin2;
    triOut1[1] = IP2;
    triOut1[2] = IP1;

    return [triOut0, triOut1];
  }

  /**
   * Project a world-space segment [A, B] to one or more screen-space
   * polylines, clipping against the near plane.
   *
   * Returns:
   *   []                if fully behind the near plane
   *   [[P0, P1]]        if fully in front of the near plane
   *   [[P_inside, P_I]] if crossing the near plane
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
      into.a = ndcToScreen(ndcAScratch, screenWidth, screenHeight);
      into.b = ndcToScreen(ndcBScratch, screenWidth, screenHeight);
      into.clipped = false;
      return true;
    }

    const t = (NEAR - aCamScratch.y) / (bCamScratch.y - aCamScratch.y);
    vec3.lerpInto(intersectScratch, aCamScratch, bCamScratch, t);
    this.projectCameraPointToNdcInto(ndcIScratch, intersectScratch);

    if (inA) {
      // A inside, B outside => return { a, i }
      this.projectCameraPointToNdcInto(ndcAScratch, aCamScratch);
      into.a = ndcToScreen(ndcAScratch, screenWidth, screenHeight);
      into.b = ndcToScreen(ndcIScratch, screenWidth, screenHeight);
    } else {
      // B inside, A outside => return { i, b }
      this.projectCameraPointToNdcInto(ndcBScratch, bCamScratch);
      into.a = ndcToScreen(ndcIScratch, screenWidth, screenHeight);
      into.b = ndcToScreen(ndcBScratch, screenWidth, screenHeight);
    }

    into.clipped = true;
    return true;
  }

  /**
   * Compute focal lengths (fX, fY) for a perspective projection.
   *
   * The camera is parameterized in terms of a vertical field of view
   * and a “circle condition” so that a sphere centered on the view axis
   * appears circular in screen space, even when canvasWidth != canvasHeight.
   */
  private getFocalLengths(
    canvasWidth: number,
    canvasHeight: number,
  ): { fX: number; fY: number } {
    const vFovRad = (VERTICAL_FOV * Math.PI) / 180;

    const fY = 1 / Math.tan(vFovRad / 2);
    const fX = fY * (canvasHeight / canvasWidth);

    return { fX, fY };
  }

  /**
   * True if a camera-space point is in front of the near plane.
   */
  private isInFrontOfNearPlane(p: Vec3): boolean {
    return p.y >= NEAR;
  }
}
