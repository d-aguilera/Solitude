import type { DomainCameraPose } from "../app/appPorts.js";
import type { Mat3, Vec3 } from "../domain/domainPorts.js";
import { mat3FromLocalFrame } from "../domain/localFrame.js";
import { mat3 } from "../domain/mat3.js";
import { vec3 } from "../domain/vec3.js";
import type { NdcPoint } from "./scenePorts.js";

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
  private readonly pose: DomainCameraPose;
  private readonly fX: number;
  private readonly fY: number;

  constructor(
    pose: DomainCameraPose,
    canvasWidth: number,
    canvasHeight: number,
  ) {
    this.pose = pose;

    const { fX, fY } = this.getFocalLengths(canvasWidth, canvasHeight);
    this.fX = fX;
    this.fY = fY;
  }

  /**
   * Full world-space -> NDC projection with near-plane rejection.
   *
   * Returns null when the point lies behind the near plane in camera space.
   */
  projectWorldPointToNdc(worldPoint: Vec3): NdcPoint | null {
    const cameraPoint = this.worldPointToCameraPointNoClip(worldPoint);
    return this.isInFrontOfNearPlane(cameraPoint)
      ? this.projectCameraPointToNdc(cameraPoint)
      : null;
  }

  /**
   * Convert world-space points into camera space.
   */
  worldPointsToCameraPointsNoClip(worldPoints: Vec3[]): Vec3[] {
    const { position, frame } = this.pose;
    const R_worldFromLocal = mat3FromLocalFrame(frame);
    const R_localFromWorld = mat3.transpose(R_worldFromLocal);

    const n = worldPoints.length;
    const cameraPoints = new Array<Vec3>(n);

    for (let i = 0; i < n; i++) {
      cameraPoints[i] = this.worldPointToCameraPointNoClip2(
        worldPoints[i],
        R_localFromWorld,
        position,
      );
    }

    return cameraPoints;
  }

  /**
   * World-space -> camera-space for a single point, without clipping.
   */
  private worldPointToCameraPointNoClip(worldPoint: Vec3): Vec3 {
    const { position, frame } = this.pose;
    const R_worldFromLocal = mat3FromLocalFrame(frame);
    const R_localFromWorld = mat3.transpose(R_worldFromLocal);
    return this.worldPointToCameraPointNoClip2(
      worldPoint,
      R_localFromWorld,
      position,
    );
  }

  private worldPointToCameraPointNoClip2(
    worldPoint: Vec3,
    R_localFromWorld: Mat3,
    position: Vec3,
  ): Vec3 {
    return mat3.mulVec3(R_localFromWorld, vec3.sub(worldPoint, position));
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
