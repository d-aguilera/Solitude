import type { DomainCameraPose } from "../app/appPorts.js";
import type { Mat3, Vec3 } from "../domain/domainPorts.js";
import { mat3FromLocalFrame } from "../domain/localFrame.js";
import { mat3 } from "../domain/mat3.js";
import { vec3 } from "../domain/vec3.js";
import type { NdcPoint, ScreenPoint } from "./renderPorts.js";
import { ndcToScreen } from "./ndcToScreen.js";
import { alloc } from "../infra/allocProfiler.js";

/**
 * Camera-space forward threshold.
 */
const NEAR = 0.01;

/**
 * Vertical field of view in degrees.
 */
const VERTICAL_FOV = 30;

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

  private readonly scratchDelta: Vec3 = { x: 0, y: 0, z: 0 };

  constructor(
    pose: DomainCameraPose,
    canvasWidth: number,
    canvasHeight: number,
  ) {
    const { fX, fY } = this.getFocalLengths(canvasWidth, canvasHeight);
    this.fX = fX;
    this.fY = fY;

    const R_worldFromLocal = mat3FromLocalFrame(pose.frame);
    this.R_localFromWorld = mat3.transpose(R_worldFromLocal);
    this.cameraPosition = pose.position;
  }

  private readonly cameraPointScratch1: Vec3 = { x: 0, y: 0, z: 0 };

  /**
   * Full world-space -> NDC projection with near-plane rejection.
   *
   * Returns null when the point lies behind the near plane in camera space.
   */
  projectWorldPointToNdc(worldPoint: Vec3): NdcPoint | null {
    this.worldPointToCameraPointNoClipInto(
      this.cameraPointScratch1,
      worldPoint,
    );
    return this.isInFrontOfNearPlane(this.cameraPointScratch1)
      ? this.projectCameraPointToNdc(this.cameraPointScratch1)
      : null;
  }

  /**
   * Convert world-space points into camera space.
   *
   * Reuses internal scratch objects and returns a freshly sized array of
   * Vec3 instances that are stable for the caller while this method runs.
   */
  private cameraPointScratchArray: Vec3[] = [];

  worldPointsToCameraPointsNoClip(worldPoints: Vec3[]): Vec3[] {
    return alloc.withName("worldPointsToCameraPointsNoClip", () => {
      const n = worldPoints.length;

      if (this.cameraPointScratchArray.length < n) {
        // Grow with stable Vec3 objects
        for (let i = this.cameraPointScratchArray.length; i < n; i++) {
          this.cameraPointScratchArray[i] = vec3.zero();
        }
      }

      const cameraPoints = this.cameraPointScratchArray;
      const R_localFromWorld = this.R_localFromWorld;
      const position = this.cameraPosition;
      const delta = this.scratchDelta;

      for (let i = 0; i < n; i++) {
        const wp = worldPoints[i];

        // delta = worldPoint - cameraPosition
        vec3.subInto(delta, wp, position);

        // cameraPoints[i] = R_localFromWorld * delta
        mat3.mulVec3Into(cameraPoints[i], R_localFromWorld, delta);
      }

      // Callers must only use first n entries.
      cameraPoints.length = n;
      return cameraPoints;
    });
  }

  /**
   * World-space -> camera-space for a single point, without clipping.
   */
  private worldPointToCameraPointNoClipInto(
    into: Vec3,
    worldPoint: Vec3,
  ): void {
    const delta = this.scratchDelta;

    // delta = worldPoint - cameraPosition
    vec3.subInto(delta, worldPoint, this.cameraPosition);

    // into (cameraPoint) = R_localFromWorld * delta
    mat3.mulVec3Into(into, this.R_localFromWorld, delta);
  }

  /**
   * Core projection from camera space -> NDC using this service's
   * canvas‑specific focal lengths.
   */
  projectCameraPointToNdc(cameraPoint: Vec3): NdcPoint {
    const depth = cameraPoint.y;

    const scaled = vec3.scale(
      { x: cameraPoint.x * this.fX, y: cameraPoint.z * this.fY, z: 0 },
      1 / depth,
    );

    return {
      x: scaled.x,
      y: scaled.y,
      depth,
    };
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

  private readonly aCamScratch: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly bCamScratch: Vec3 = { x: 0, y: 0, z: 0 };

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
    const aCam = this.aCamScratch;
    const bCam = this.bCamScratch;

    // 1) World -> camera space
    this.worldPointToCameraPointNoClipInto(aCam, aWorld);
    this.worldPointToCameraPointNoClipInto(bCam, bWorld);

    const inA = this.isInFrontOfNearPlane(aCam);
    const inB = this.isInFrontOfNearPlane(bCam);

    // Both behind near plane: discard
    if (!inA && !inB) {
      return [];
    }

    // Helper for intersection with y = NEAR in camera space
    const intersect = (p: Vec3, q: Vec3): Vec3 => {
      const t = (NEAR - p.y) / (q.y - p.y);
      return {
        x: p.x + t * (q.x - p.x),
        y: NEAR,
        z: p.z + t * (q.z - p.z),
      };
    };

    // Both in front of near plane: project as-is
    if (inA && inB) {
      const ndcA = this.projectCameraPointToNdc(aCam);
      const ndcB = this.projectCameraPointToNdc(bCam);
      return [
        [
          ndcToScreen(ndcA, screenWidth, screenHeight),
          ndcToScreen(ndcB, screenWidth, screenHeight),
        ],
      ];
    }

    // One inside, one outside: clip at near plane and keep visible half
    const insideCam = inA ? aCam : bCam;
    const outsideCam = inA ? bCam : aCam;

    const I = intersect(insideCam, outsideCam);

    const ndcInside = this.projectCameraPointToNdc(insideCam);
    const ndcI = this.projectCameraPointToNdc(I);

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
