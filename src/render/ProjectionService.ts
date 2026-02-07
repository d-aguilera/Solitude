import type { DomainCameraPose } from "../app/appPorts.js";
import type { Mat3, Vec3 } from "../domain/domainPorts.js";
import { mat3FromLocalFrameInto } from "../domain/localFrame.js";
import { mat3 } from "../domain/mat3.js";
import { vec3 } from "../domain/vec3.js";
import { lerpInto } from "../domain/vec3Util.js";
import { alloc } from "../global/allocProfiler.js";
import type { NdcPoint, ScreenPoint } from "./renderPorts.js";
import { ndcToScreen } from "./ndcToScreen.js";

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

        mat3FromLocalFrameInto(R_worldFromLocalScratch, pose.frame);
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
  projectWorldPointToNdc(worldPoint: Vec3): NdcPoint | null {
    this.worldPointToCameraPointNoClipInto(cameraPointScratch, worldPoint);
    return this.isInFrontOfNearPlane(cameraPointScratch)
      ? this.projectCameraPointToNdc(cameraPointScratch)
      : null;
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
        const wp = worldPoints[i];

        // delta = worldPoint - cameraPosition
        vec3.subInto(deltaScratch, wp, position);

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
  projectCameraPointToNdc(cameraPoint: Vec3): NdcPoint {
    const depth = cameraPoint.y;
    const invDepth = 1 / depth;

    return {
      x: cameraPoint.x * this.fX * invDepth,
      y: cameraPoint.z * this.fY * invDepth,
      depth,
    };
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

    const [P0, P1, P2] = [a, b, c];

    if (insideCount === 1) {
      // One inside: result is a single clipped triangle.
      // Pick the inside vertex P and the two outside vertices Q,R.
      let P: Vec3, Q: Vec3, R: Vec3;
      if (inA) {
        P = P0;
        Q = P1;
        R = P2;
      } else if (inB) {
        P = P1;
        Q = P2;
        R = P0;
      } else {
        P = P2;
        Q = P0;
        R = P1;
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
      Pout = P0;
      Pin1 = P1;
      Pin2 = P2;
    } else if (!inB) {
      Pout = P1;
      Pin1 = P2;
      Pin2 = P0;
    } else {
      Pout = P2;
      Pin1 = P0;
      Pin2 = P1;
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
  projectWorldSegmentToScreen(
    aWorld: Vec3,
    bWorld: Vec3,
    screenWidth: number,
    screenHeight: number,
  ): ScreenPoint[][] {
    // 1) World -> camera space
    this.worldPointToCameraPointNoClipInto(aCamScratch, aWorld);
    this.worldPointToCameraPointNoClipInto(bCamScratch, bWorld);

    const inA = this.isInFrontOfNearPlane(aCamScratch);
    const inB = this.isInFrontOfNearPlane(bCamScratch);

    // Both behind near plane: discard
    if (!inA && !inB) {
      return [];
    }

    // Both in front of near plane: project as-is
    if (inA && inB) {
      const ndcA = this.projectCameraPointToNdc(aCamScratch);
      const ndcB = this.projectCameraPointToNdc(bCamScratch);
      return [
        [
          ndcToScreen(ndcA, screenWidth, screenHeight),
          ndcToScreen(ndcB, screenWidth, screenHeight),
        ],
      ];
    }

    // One inside, one outside: clip at near plane and keep visible half
    const insideCam = inA ? aCamScratch : bCamScratch;
    const outsideCam = inA ? bCamScratch : aCamScratch;

    // Intersect with plane y = NEAR using lerpInto
    const t = (NEAR - insideCam.y) / (outsideCam.y - insideCam.y);
    lerpInto(intersectScratch, insideCam, outsideCam, t);
    intersectScratch.y = NEAR;

    const ndcInside = this.projectCameraPointToNdc(insideCam);
    const ndcI = this.projectCameraPointToNdc(intersectScratch);

    const pInside = ndcToScreen(ndcInside, screenWidth, screenHeight);
    const pI = ndcToScreen(ndcI, screenWidth, screenHeight);

    return [[pInside, pI]];
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
