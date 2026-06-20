import type { DomainCameraPose } from "../app/scenePorts";
import { localFrame } from "../domain/localFrame";
import { type Mat3, mat3 } from "../domain/mat3";
import { type Vec3, vec3 } from "../domain/vec3";
import { type NdcPoint, ndc } from "./ndc";
import type { ProjectedSegment } from "./renderInternals";
import {
  getRenderFocalLengthX,
  renderFocalLengthY,
  renderNearDepth,
} from "./renderParameters";

/**
 * Camera-space forward threshold.
 */
const NEAR = renderNearDepth;
const FAR = Number.POSITIVE_INFINITY;

export interface ProjectionWorkspace {
  deltaScratch: Vec3;
  cameraPointScratch: Vec3;
  aCamScratch: Vec3;
  bCamScratch: Vec3;
  ndcAScratch: NdcPoint;
  ndcBScratch: NdcPoint;
  clipChangedScratch: { value: boolean };
}

export function createProjectionWorkspace(): ProjectionWorkspace {
  return {
    deltaScratch: vec3.zero(),
    cameraPointScratch: vec3.zero(),
    aCamScratch: vec3.zero(),
    bCamScratch: vec3.zero(),
    ndcAScratch: ndc.zero(),
    ndcBScratch: ndc.zero(),
    clipChangedScratch: { value: false },
  };
}

let x1: number, y1: number, z1: number;
let x2: number, y2: number, z2: number;
let dx: number, dy: number, dz: number;

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
  private focalLengthY: number;
  private tanHalfFovX: number;
  private tanHalfFovY: number;

  // Precomputed camera transform helpers for segment/point projection.
  private readonly R_localFromWorld: Mat3;
  private cameraPosition: Vec3;

  constructor(
    pose: DomainCameraPose,
    canvasWidth: number,
    canvasHeight: number,
    private readonly workspace: ProjectionWorkspace = createProjectionWorkspace(),
  ) {
    this.focalLengthX = getRenderFocalLengthX(canvasWidth, canvasHeight);
    this.focalLengthY = renderFocalLengthY;
    this.tanHalfFovY = 1 / this.focalLengthY;
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
    this.focalLengthX = getRenderFocalLengthX(canvasWidth, canvasHeight);
    this.focalLengthY = renderFocalLengthY;
    this.tanHalfFovY = 1 / this.focalLengthY;
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
    const cameraPointScratch = this.workspace.cameraPointScratch;
    this.worldPointToCameraPointNoClipInto(cameraPointScratch, worldPoint);
    if (this.computeOutCode(cameraPointScratch)) {
      return false;
    }
    this.projectCameraPointToNdcInto(into, cameraPointScratch);
    return true;
  }

  /**
   * World-space -> camera-space for a single point, without clipping.
   */
  private worldPointToCameraPointNoClipInto(
    into: Vec3,
    worldPoint: Vec3,
  ): void {
    const deltaScratch = this.workspace.deltaScratch;
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
    into.y = (cameraPoint.z * this.focalLengthY) / depth;
    into.depth = depth;
  }

  /**
   * Camera-space forward depth (y) for a world-space point.
   */
  getCameraDepthForWorldPoint(worldPoint: Vec3): number {
    const cameraPointScratch = this.workspace.cameraPointScratch;
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
    return (diameterWorld * this.focalLengthY * screenHeight) / diameterPixels;
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
    const aCamScratch = this.workspace.aCamScratch;
    const bCamScratch = this.workspace.bCamScratch;
    const clipChangedScratch = this.workspace.clipChangedScratch;
    const ndcAScratch = this.workspace.ndcAScratch;
    const ndcBScratch = this.workspace.ndcBScratch;
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
      x1 = p.x;
      y1 = p.y;
      z1 = p.z;
      x2 = q.x;
      y2 = q.y;
      z2 = q.z;
      dx = x2 - x1;
      dy = y2 - y1;
      dz = z2 - z1;

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
