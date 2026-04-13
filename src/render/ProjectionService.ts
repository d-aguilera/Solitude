import type { DomainCameraPose } from "../app/scenePorts";
import { localFrame } from "../domain/localFrame";
import { type Mat3, mat3 } from "../domain/mat3";
import { type Vec3, vec3 } from "../domain/vec3";
import { alloc } from "../global/allocProfiler";
import { type NdcPoint, ndc } from "./ndc";
import type { ProjectedSegment } from "./renderInternals";

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

/** Ensure the global camera-point pool can hold at least `n` Vec3s. */
function ensureGlobalCameraPointPoolCapacity(n: number): void {
  const length = GLOBAL_CAMERA_POINT_POOL.length;
  if (length < n) {
    alloc.withName(ensureGlobalCameraPointPoolCapacity.name, () => {
      for (let i = length; i < n; i++) {
        GLOBAL_CAMERA_POINT_POOL.push(vec3.zero());
      }
    });
  }
}

// scratch
const deltaScratch: Vec3 = vec3.zero();
const cameraPointScratch: Vec3 = vec3.zero();

const aCamScratch: Vec3 = vec3.zero();
const bCamScratch: Vec3 = vec3.zero();

const ndcAScratch: NdcPoint = ndc.zero();
const ndcBScratch: NdcPoint = ndc.zero();

const clipChangedScratch = { value: false };

/**
 * Scratch polygons used during triangle clipping.
 */
const MAX_CLIPPED_VERTS = 9;
const polyInScratch: Vec3[] = [];
const polyOutScratch: Vec3[] = [];
for (let i = 0; i < MAX_CLIPPED_VERTS; i++) {
  polyInScratch.push(vec3.zero());
  polyOutScratch.push(vec3.zero());
}

type FrustumPlane = "NEAR" | "FAR" | "LEFT" | "RIGHT" | "TOP" | "BOTTOM";

const planes: FrustumPlane[] = [
  "NEAR",
  "FAR",
  "LEFT",
  "RIGHT",
  "TOP",
  "BOTTOM",
];

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
  private focalLengthX: number;
  private tanHalfFovX: number;
  private tanHalfFovY: number;

  // Precomputed camera transform helpers for segment/point projection.
  private readonly R_localFromWorld: Mat3;
  private cameraPosition: Vec3;

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

  reset(
    pose: DomainCameraPose,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    this.focalLengthX = focalLengthY * (canvasHeight / canvasWidth);
    this.tanHalfFovY = 1 / focalLengthY;
    this.tanHalfFovX = 1 / this.focalLengthX;

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
    if (this.computeOutCode(cameraPointScratch)) {
      return false;
    }
    this.projectCameraPointToNdcInto(into, cameraPointScratch);
    return true;
  }

  worldPointsToCameraPointsNoClip(worldPoints: Vec3[]): Vec3[] {
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
   * Camera-space forward depth (y) for a world-space point.
   */
  getCameraDepthForWorldPoint(worldPoint: Vec3): number {
    this.worldPointToCameraPointNoClipInto(cameraPointScratch, worldPoint);
    return cameraPointScratch.y;
  }

  /**
   * Camera-space depth where a world-space diameter projects to a target number
   * of screen pixels in the vertical axis.
   */
  depthForProjectedDiameterPixels(
    diameterWorld: number,
    diameterPixels: number,
    screenHeight: number,
  ): number {
    if (diameterWorld <= 0 || diameterPixels <= 0 || screenHeight <= 0) {
      return Number.POSITIVE_INFINITY;
    }

    // pixelDiameter = diameterWorld * focalLengthY * screenHeight / depth
    return (diameterWorld * focalLengthY * screenHeight) / diameterPixels;
  }

  /**
   * Return true if a camera-space point is inside the half-space of a given plane.
   */
  private isInsidePlane(p: Vec3, plane: FrustumPlane): boolean {
    const { x, y, z } = p;
    let limitX: number;
    let limitY: number;
    let limitZ: number;

    switch (plane) {
      case "NEAR":
        limitY = NEAR;
        return y >= limitY;
      case "FAR":
        limitY = FAR;
        return y <= limitY;
      case "LEFT": {
        if (y <= 0 || !Number.isFinite(y)) return false;
        limitX = y * this.tanHalfFovX;
        return x >= -limitX;
      }
      case "RIGHT": {
        if (y <= 0 || !Number.isFinite(y)) return false;
        limitX = y * this.tanHalfFovX;
        return x <= limitX;
      }
      case "TOP": {
        if (y <= 0 || !Number.isFinite(y)) return false;
        limitZ = y * this.tanHalfFovY;
        return z >= -limitZ;
      }
      case "BOTTOM": {
        if (y <= 0 || !Number.isFinite(y)) return false;
        limitZ = y * this.tanHalfFovY;
        return z <= limitZ;
      }
    }
  }

  /**
   * Intersect segment [p,q] with a given frustum plane, writing into dst.
   * Assumes p and q are not both on the same side of the plane.
   */
  private intersectWithPlane(
    dst: Vec3,
    p: Vec3,
    q: Vec3,
    plane: FrustumPlane,
  ): void {
    const { x: x1, y: y1, z: z1 } = p;
    const { x: x2, y: y2, z: z2 } = q;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;

    let denom: number;
    let t = 0;

    switch (plane) {
      case "NEAR": {
        denom = dy;
        if (denom === 0) {
          // Degenerate: just clamp to plane
          dst.x = x1;
          dst.y = NEAR;
          dst.z = z1;
          return;
        }
        t = (NEAR - y1) / denom;
        break;
      }
      case "FAR": {
        denom = dy;
        if (denom === 0) {
          dst.x = x1;
          dst.y = FAR;
          dst.z = z1;
          return;
        }
        t = (FAR - y1) / denom;
        break;
      }
      case "LEFT": {
        const tx = this.tanHalfFovX;
        denom = dx + dy * tx;
        if (denom === 0) {
          dst.x = -y1 * tx;
          dst.y = y1;
          dst.z = z1;
          return;
        }
        t = -(x1 + y1 * tx) / denom;
        break;
      }
      case "RIGHT": {
        const tx = this.tanHalfFovX;
        denom = dx - dy * tx;
        if (denom === 0) {
          dst.x = y1 * tx;
          dst.y = y1;
          dst.z = z1;
          return;
        }
        t = (y1 * tx - x1) / denom;
        break;
      }
      case "TOP": {
        const tz = this.tanHalfFovY;
        denom = dz + dy * tz;
        if (denom === 0) {
          dst.x = x1;
          dst.y = y1;
          dst.z = -y1 * tz;
          return;
        }
        t = -(z1 + y1 * tz) / denom;
        break;
      }
      case "BOTTOM": {
        const tz = this.tanHalfFovY;
        denom = dz - dy * tz;
        if (denom === 0) {
          dst.x = x1;
          dst.y = y1;
          dst.z = y1 * tz;
          return;
        }
        t = (y1 * tz - z1) / denom;
        break;
      }
    }

    // Clamp t to [0,1] defensively.
    if (!Number.isFinite(t) || t < 0) {
      t = 0;
    } else if (t > 1) {
      t = 1;
    }

    dst.x = x1 + dx * t;
    dst.y = y1 + dy * t;
    dst.z = z1 + dz * t;
  }

  /**
   * Clip a convex polygon (triangle) in camera space against a single frustum plane.
   *
   * inVerts:  array of vertices
   * inCount:  number of valid vertices in inVerts (<= inVerts.length)
   * outVerts: destination array; may alias inVerts (we still use indices)
   *
   * Returns new vertex count.
   */
  private clipPolygonAgainstPlane(
    inVerts: Vec3[],
    inCount: number,
    outVerts: Vec3[],
    plane: FrustumPlane,
  ): number {
    if (inCount === 0) return 0;

    let outCount = 0;

    // Start with the last vertex as the "previous" one to close the polygon.
    let prev = inVerts[inCount - 1];
    let prevInside = this.isInsidePlane(prev, plane);

    for (let i = 0; i < inCount; i++) {
      const curr = inVerts[i];
      const currInside = this.isInsidePlane(curr, plane);

      if (currInside) {
        if (prevInside) {
          // in -> in : keep curr
          vec3.copyInto(outVerts[outCount], curr);
          outCount++;
        } else {
          // out -> in : emit intersection, then curr
          this.intersectWithPlane(outVerts[outCount], prev, curr, plane);
          outCount++;
          vec3.copyInto(outVerts[outCount], curr);
          outCount++;
        }
      } else if (prevInside) {
        // in -> out : emit intersection
        this.intersectWithPlane(outVerts[outCount], prev, curr, plane);
        outCount++;
      }

      prev = curr;
      prevInside = currInside;
    }

    return outCount;
  }

  /**
   * Clip a camera-space triangle against the full view frustum (6 planes).
   *
   * into: up to 6 resulting triangles in camera space. It would be 7 if
   * the FAR plane was not set at infinity.
   * Returns 0..5 (number of triangles written).
   *
   * The Vec3s in `into` refer to internal scratch storage that is only valid
   * until the next call. Callers must consume immediately.
   */
  clipTriangleAgainstFrustumCamera(
    into: [
      [Vec3, Vec3, Vec3],
      [Vec3, Vec3, Vec3],
      [Vec3, Vec3, Vec3],
      [Vec3, Vec3, Vec3],
      [Vec3, Vec3, Vec3],
      [Vec3, Vec3, Vec3],
    ],
    a: Vec3,
    b: Vec3,
    c: Vec3,
  ): number {
    // Initialize polygon with original triangle
    const inVerts = polyInScratch;
    const outVerts = polyOutScratch;

    vec3.copyInto(inVerts[0], a);
    vec3.copyInto(inVerts[1], b);
    vec3.copyInto(inVerts[2], c);
    let count = 3;

    let src = inVerts;
    let dst = outVerts;

    for (let i = 0; i < planes.length; i++) {
      const plane = planes[i];
      count = this.clipPolygonAgainstPlane(src, count, dst, plane);
      if (count === 0) {
        return 0;
      }
      const tmp = src;
      src = dst;
      dst = tmp;
    }

    // Now src[0..count-1] is the final polygon
    const triangles = count - 2;
    const v0 = src[0];

    for (let t = 0; t < triangles; t++) {
      const tri = into[t];
      const T0 = tri[0];
      const T1 = tri[1];
      const T2 = tri[2];
      vec3.copyInto(T0, v0);
      vec3.copyInto(T1, src[t + 1]);
      vec3.copyInto(T2, src[t + 2]);
    }

    if (triangles === 6) {
      console.log({ a, b, c });
    }

    return triangles;
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
   * Compute a 6-bit outcode for a camera-space point against the frustum.
   */
  computeOutCode(p: Vec3): number {
    const y = p.y;
    let code = 0;

    if (y < NEAR) code |= OUT_NEAR;
    if (y > FAR) code |= OUT_FAR;

    if (y > 0 && Number.isFinite(y)) {
      const limitX = y * this.tanHalfFovX;
      const x = p.x;
      if (x < -limitX) code |= OUT_LEFT;
      if (x > limitX) code |= OUT_RIGHT;

      const limitZ = y * this.tanHalfFovY;
      const z = p.z;
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
