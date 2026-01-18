import type { Vec3, LocalFrame } from "../domain/domainPorts.js";
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
 * Canonical camera representation used throughout world/scene transforms.
 */
export interface CameraPose {
  position: Vec3;
  frame: LocalFrame;
}

/**
 * Projection service responsible for:
 *  - Transforming world-space positions into camera space
 *  - Clipping against the near plane
 *  - Mapping camera-space positions into NDC
 *
 * The service is parameterized by a camera pose and canvas size.
 */
export class ProjectionService {
  private readonly camera: CameraPose;
  private readonly fX: number;
  private readonly fY: number;

  constructor(camera: CameraPose, canvasWidth: number, canvasHeight: number) {
    this.camera = camera;

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
   * World-space -> camera-space for a single point, without clipping.
   */
  worldPointToCameraPointNoClip(worldPoint: Vec3): Vec3 {
    const { position: cameraPos, frame: cameraFrame } = this.camera;

    const R_worldFromLocal = mat3FromLocalFrame(cameraFrame);
    const R_localFromWorld = mat3.transpose(R_worldFromLocal);

    const dx = worldPoint.x - cameraPos.x;
    const dy = worldPoint.y - cameraPos.y;
    const dz = worldPoint.z - cameraPos.z;

    return {
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
