import type { DomainCameraPose } from "../app/appPorts.js";
import { localFrame } from "../domain/localFrame.js";
import { type Mat3, mat3 } from "../domain/mat3.js";
import { type Vec3, vec3 } from "../domain/vec3.js";
import { alloc } from "../global/allocProfiler.js";
import { type NdcPoint, ndc } from "./ndc.js";
import type { ProjectedSegment } from "./renderInternals.js";

/**
 * Camera-space forward threshold.
 */
const NEAR = 0.01;
const FAR = Number.POSITIVE_INFINITY;

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

const ndcAScratch: NdcPoint = ndc.zero();
const ndcBScratch: NdcPoint = ndc.zero();

const clipChangedScratch = { value: false };

/**
 * Per-point frustum outcode bits in camera space.
 *
 * Planes:
 *  - NEAR:    y >= NEAR
 *  - FAR:     y <= FAR
 *  - LEFT:    x >= -y * tanHalfFovX
 *  - RIGHT:   x <=  y * tanHalfFovX
 *  - TOP:     z >= -y * tanHalfFovY
 *  - BOTTOM:  z <=  y * tanHalfFovY
 */
const OUT_NEAR = 1 << 0; // behind near (y < NEAR)
const OUT_FAR = 1 << 1; // beyond far (y > FAR)
const OUT_LEFT = 1 << 2;
const OUT_RIGHT = 1 << 3;
const OUT_TOP = 1 << 4;
const OUT_BOTTOM = 1 << 5;

/**
 * Projection service responsible for:
 *  - Transforming world-space positions into camera space
 *  - Clipping against the camera frustum
 *  - Mapping camera-space positions into NDC
 *
 * The service is parameterized by a camera pose and canvas size.
 */
export class ProjectionService {
  private readonly focalLengthX: number;
  private readonly tanHalfFovX: number;
  private readonly tanHalfFovY: number;

  // Precomputed camera transform helpers for segment/point projection.
  private readonly R_localFromWorld: Mat3;
  private readonly cameraPosition: Vec3;

  constructor(
    pose: DomainCameraPose,
    canvasWidth: number,
    canvasHeight: number,
  ) {
    this.focalLengthX = focalLengthY * (canvasHeight / canvasWidth);
    this.tanHalfFovY = 1 / focalLengthY;
    this.tanHalfFovX = 1 / this.focalLengthX;

    this.R_localFromWorld = mat3.zero();
    localFrame.intoMat3(this.R_localFromWorld, pose.frame);
    mat3.transposeInto(this.R_localFromWorld, this.R_localFromWorld);

    this.cameraPosition = pose.position;
  }

  /**
   * Full world-space -> NDC projection with near-plane rejection.
   *
   * Returns false when the point lies outside the camera frustum.
   */
  projectWorldPointToNdcInto(into: NdcPoint, worldPoint: Vec3): boolean {
    this.worldPointToCameraPointNoClipInto(cameraPointScratch, worldPoint);
    if (!this.isInsideFrustum(cameraPointScratch)) {
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
   * polylines, clipping against the camera frustum.
   * It returns `false` if the segment is fully outside the frustum.
   * Otherwise, it returns `true` and sets `into` as following:
   *   { A', B', false } if both A and B are fully inside the frustum.
   * If either A or B is not inside the frustum, then I is an intersection
   * point between the segment and a frustum plane and the function returns
   * `true` and sets `into` as follows:
   *   { A', I,  true  } if A is inside and B is outside
   *   { I,  B', true  } if B is inside and A is outside
   * When both endpoints lie outside but the segment crosses the frustum,
   * A' and B' are the two intersection points on the frustum boundary.
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

    // 2) Clip segment in camera space against full frustum.
    clipChangedScratch.value = false;
    if (
      !this.clipSegmentCameraFrustum(
        aCamScratch,
        bCamScratch,
        clipChangedScratch,
      )
    ) {
      return false;
    }

    // 3) Project the resulting camera-space points to screen space.
    this.projectCameraPointToNdcInto(ndcAScratch, aCamScratch);
    this.projectCameraPointToNdcInto(ndcBScratch, bCamScratch);
    ndc.toScreenInto(into.a, ndcAScratch, screenWidth, screenHeight);
    ndc.toScreenInto(into.b, ndcBScratch, screenWidth, screenHeight);

    // 4) Mark whether we had to clip at least one endpoint.
    //
    // We consider the segment "clipped" whenever the clipping step
    // moved at least one endpoint onto a frustum plane.
    into.clipped = clipChangedScratch.value;

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

  /**
   * True if a camera-space point lies inside the view frustum
   * (between near/far planes and inside the horizontal/vertical FOV).
   */
  private isInsideFrustum(p: Vec3): boolean {
    const y = p.y;
    if (y < NEAR || y > FAR) return false;

    const limitX = y * this.tanHalfFovX;
    const limitZ = y * this.tanHalfFovY;

    const x = p.x;
    const z = p.z;

    if (x < -limitX || x > limitX) return false;
    if (z < -limitZ || z > limitZ) return false;

    return true;
  }

  /**
   * Compute a 6-bit outcode for a camera-space point against the frustum.
   */
  private computeOutCode(p: Vec3): number {
    const y = p.y;
    let code = 0;

    if (y < NEAR) code |= OUT_NEAR;
    if (y > FAR) code |= OUT_FAR;

    if (y > 0 && Number.isFinite(y)) {
      const limitX = y * this.tanHalfFovX;
      const limitZ = y * this.tanHalfFovY;
      const x = p.x;
      const z = p.z;

      if (x < -limitX) code |= OUT_LEFT;
      if (x > limitX) code |= OUT_RIGHT;
      if (z < -limitZ) code |= OUT_TOP;
      if (z > limitZ) code |= OUT_BOTTOM;
    }

    return code;
  }

  /**
   * Clip a camera-space segment [a,b] against the view frustum in camera space.
   *
   * On success, `a` and `b` are mutated in-place to the clipped endpoints.
   * Returns true if the segment has any portion inside the frustum, false if it
   * lies entirely outside.
   *
   * The `changed` flag is set to true when at least one endpoint was moved
   * during clipping, i.e. the segment touched the frustum boundary.
   */
  private clipSegmentCameraFrustum(
    a: Vec3,
    b: Vec3,
    changed: { value: boolean },
  ): boolean {
    let codeA = this.computeOutCode(a);
    let codeB = this.computeOutCode(b);

    // Trivial accept: both endpoints already inside.
    if ((codeA | codeB) === 0) {
      return true;
    }

    // Trivial reject: segment is fully outside at least one shared half-space.
    if ((codeA & codeB) !== 0) {
      return false;
    }

    for (let iter = 0; iter < 8; iter++) {
      if ((codeA | codeB) === 0) {
        return true;
      }
      if ((codeA & codeB) !== 0) {
        return false;
      }

      const useA = codeA !== 0;
      const outCode = useA ? codeA : codeB;
      const p = useA ? a : b;
      const q = useA ? b : a;
      const { x: x1, y: y1, z: z1 } = p;
      const { x: x2, y: y2, z: z2 } = q;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dz = z2 - z1;

      let t = 0;
      if (outCode & OUT_NEAR) {
        const denom = dy;
        if (denom === 0) return false;
        t = (NEAR - y1) / denom;
        if (t < 0 || t > 1 || !Number.isFinite(t)) return false;
        p.x = x1 + dx * t;
        p.y = NEAR;
        p.z = z1 + dz * t;
      } else if (outCode & OUT_FAR) {
        const denom = dy;
        if (denom === 0) return false;
        t = (FAR - y1) / denom;
        if (t < 0 || t > 1 || !Number.isFinite(t)) return false;
        p.x = x1 + dx * t;
        p.y = FAR;
        p.z = z1 + dz * t;
      } else if (outCode & OUT_LEFT) {
        const tx = this.tanHalfFovX;
        const denom = dx + dy * tx;
        if (denom === 0) return false;
        t = -(x1 + y1 * tx) / denom;
        if (t < 0 || t > 1 || !Number.isFinite(t)) return false;
        const y = y1 + dy * t;
        p.y = y;
        p.x = -y * tx;
        p.z = z1 + dz * t;
      } else if (outCode & OUT_RIGHT) {
        const tx = this.tanHalfFovX;
        const denom = dx - dy * tx;
        if (denom === 0) return false;
        t = (y1 * tx - x1) / denom;
        if (t < 0 || t > 1 || !Number.isFinite(t)) return false;
        const y = y1 + dy * t;
        p.y = y;
        p.x = y * tx;
        p.z = z1 + dz * t;
      } else if (outCode & OUT_TOP) {
        const tz = this.tanHalfFovY;
        const denom = dz + dy * tz;
        if (denom === 0) return false;
        t = -(z1 + y1 * tz) / denom;
        if (t < 0 || t > 1 || !Number.isFinite(t)) return false;
        const y = y1 + dy * t;
        p.y = y;
        p.x = x1 + dx * t;
        p.z = -y * tz;
      } else if (outCode & OUT_BOTTOM) {
        const tz = this.tanHalfFovY;
        const denom = dz - dy * tz;
        if (denom === 0) return false;
        t = (y1 * tz - z1) / denom;
        if (t < 0 || t > 1 || !Number.isFinite(t)) return false;
        const y = y1 + dy * t;
        p.y = y;
        p.x = x1 + dx * t;
        p.z = y * tz;
      }

      // If we reached here and actually moved p, mark the segment as changed.
      changed.value = true;

      if (useA) {
        codeA = this.computeOutCode(a);
      } else {
        codeB = this.computeOutCode(b);
      }
    }

    return (this.computeOutCode(a) | this.computeOutCode(b)) === 0;
  }
}
