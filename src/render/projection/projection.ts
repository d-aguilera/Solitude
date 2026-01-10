import { HORIZONTAL_FOCAL_LENGTH } from "../../app/config.js";
import {
  makeLocalFrameFromUp,
  localFrameFromMat3,
  mat3FromLocalFrame,
} from "../../world/localFrame.js";
import type { LocalFrame, Vec3 } from "../../world/types.js";
import { mat3, type Mat3 } from "../../world/mat3.js";
import { vec } from "../../world/vec3.js";

export interface ScreenPoint {
  x: number;
  y: number;
  depth?: number; // camera-space depth (positive means in front of camera)
}

export interface PilotViewContext {
  cameraPosition: Vec3;
  cameraFrame: LocalFrame;
  pilotAzimuth: number;
  pilotElevation: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface TopViewContext {
  cameraPosition: Vec3;
  cameraFrame: LocalFrame;
  canvasWidth: number;
  canvasHeight: number;
}

// --- PROJECTION 1: PILOT VIEW ---

export function makePilotView(ctx: PilotViewContext) {
  const { canvasWidth, canvasHeight } = ctx;

  return function pilotView(worldPoint: Vec3): ScreenPoint | null {
    const cameraPoint = worldPointToCameraPoint(
      worldPoint,
      ctx.cameraPosition,
      ctx.cameraFrame
    );

    applyPilotLook(cameraPoint, ctx.pilotAzimuth, ctx.pilotElevation);

    return projectIfInFront(cameraPoint, canvasWidth, canvasHeight);
  };
}

// --- PROJECTION 2: TOP VIEW CAMERA FRAME (PERSPECTIVE) ---

export interface TopCameraFrameState {
  initialized: boolean;
  frame: LocalFrame;
}

/**
 * Computes an updated top-camera orientation frame given the current radialUp.
 * The function is pure: it takes the previous frame state and returns a new one.
 * Callers can store this state between frames.
 */
export function updateTopCameraFrame(
  radialUp: Vec3,
  prevState: TopCameraFrameState | null
): { frame: LocalFrame; state: TopCameraFrameState } {
  let state = prevState;

  if (!state || !state.initialized) {
    const lf = makeLocalFrameFromUp(radialUp);
    const forward: Vec3 = {
      x: -radialUp.x,
      y: -radialUp.y,
      z: -radialUp.z,
    };

    // Build a rotation matrix with columns = [right, forward, up]
    const initialFrame: LocalFrame = {
      right: lf.right,
      forward,
      up: lf.forward,
    };
    const R = mat3FromLocalFrame(initialFrame);
    const frame = localFrameFromMat3(R);

    state = {
      initialized: true,
      frame,
    };
  } else {
    let {
      right: topCameraRight,
      forward: topCameraForward,
      up: topCameraUp,
    } = state.frame;

    // Project previous right and up onto plane orthogonal to radialUp
    let r: Vec3 = vec.sub(
      topCameraRight,
      vec.scale(radialUp, vec.dot(topCameraRight, radialUp))
    );
    let u: Vec3 = vec.sub(
      topCameraUp,
      vec.scale(radialUp, vec.dot(topCameraUp, radialUp))
    );

    let lenR = vec.length(r);
    let lenU = vec.length(u);

    if (lenR < 1e-6 && lenU < 1e-6) {
      const base = makeLocalFrameFromUp(radialUp);
      const forward: Vec3 = {
        x: -radialUp.x,
        y: -radialUp.y,
        z: -radialUp.z,
      };

      const resetFrame: LocalFrame = {
        right: base.right,
        forward,
        up: base.forward,
      };
      const R = mat3FromLocalFrame(resetFrame);
      const frame = localFrameFromMat3(R);

      topCameraRight = frame.right;
      topCameraForward = frame.forward;
      topCameraUp = frame.up;
    } else {
      if (lenR < 1e-6 && lenU >= 1e-6) {
        u = vec.normalize(u);
        r = vec.cross(radialUp, u);
        lenR = vec.length(r) || 1;
      } else if (lenU < 1e-6 && lenR >= 1e-6) {
        r = vec.normalize(r);
        u = vec.cross(r, radialUp);
        lenU = vec.length(u) || 1;
      }

      r = vec.normalize(r);
      u = vec.normalize(u);

      const cross = vec.cross(radialUp, r);
      const dotCrossU = vec.dot(cross, u);
      if (dotCrossU < 0) {
        u = vec.scale(u, -1);
      }

      const dotPrevU = vec.dot(topCameraUp, u);
      if (dotPrevU < 0) {
        r = vec.scale(r, -1);
        u = vec.scale(u, -1);
      }

      const f: Vec3 = vec.scale(radialUp, -1);

      const nextFrame: LocalFrame = {
        right: r,
        forward: f,
        up: u,
      };
      const R = mat3FromLocalFrame(nextFrame);
      const frame = localFrameFromMat3(R);

      topCameraRight = frame.right;
      topCameraForward = frame.forward;
      topCameraUp = frame.up;
    }

    state = {
      initialized: true,
      frame: {
        right: topCameraRight,
        forward: topCameraForward,
        up: topCameraUp,
      },
    };
  }

  return { frame: { ...state.frame }, state };
}

export function makeTopView(ctx: TopViewContext) {
  const { canvasWidth, canvasHeight } = ctx;

  return function topView(worldPoint: Vec3): ScreenPoint | null {
    const cameraPoint = worldPointToCameraPoint(
      worldPoint,
      ctx.cameraPosition,
      ctx.cameraFrame
    );

    return projectIfInFront(cameraPoint, canvasWidth, canvasHeight);
  };
}

// Translate world point into camera-relative coordinates
function worldPointToCameraPoint(
  worldPoint: Vec3,
  cameraPosition: Vec3,
  cameraFrame: LocalFrame
): Vec3 {
  const { right, forward, up } = cameraFrame;
  const R: Mat3 = [
    [right.x, right.y, right.z],
    [forward.x, forward.y, forward.z],
    [up.x, up.y, up.z],
  ];

  const d = vec.sub(worldPoint, cameraPosition);

  return mat3.mulVec3(R, d);
}

function applyPilotLook(cameraPoint: Vec3, azimuth: number, elevation: number) {
  if (azimuth === 0 && elevation === 0) {
    return;
  }

  // Azimuth: yaw around up axis -> rotate (right, forward) = (x,y)
  if (azimuth !== 0) {
    const r = rotate2D(cameraPoint.x, cameraPoint.y, -azimuth);
    cameraPoint.x = r.a; // right
    cameraPoint.y = r.b; // forward
  }

  // Elevation: pitch around right axis -> rotate (forward, up) = (y,z)
  if (elevation !== 0) {
    const r = rotate2D(cameraPoint.y, cameraPoint.z, -elevation);
    cameraPoint.y = r.a; // forward
    cameraPoint.z = r.b; // up
  }
}

function applyPerspective(
  cameraPoint: Vec3,
  canvasWidth: number,
  canvasHeight: number
): ScreenPoint {
  const aspect = canvasWidth / canvasHeight;

  const fX = HORIZONTAL_FOCAL_LENGTH;
  const fY = fX / aspect;
  const depth = cameraPoint.y;

  const scaled = vec.scale(
    { x: cameraPoint.x * fX, y: cameraPoint.z * fY, z: 0 },
    1 / depth
  );

  // NDC in [-1, 1]
  const { x: ndcX, y: ndcY } = scaled;

  return {
    x: (ndcX + 1) * 0.5 * canvasWidth,
    y: (1 - ndcY) * 0.5 * canvasHeight,
    depth,
  };
}

function rotate2D(
  a: number,
  b: number,
  angle: number
): { a: number; b: number } {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  return {
    a: a * c - b * s,
    b: a * s + b * c,
  };
}

function projectIfInFront(
  cameraPoint: Vec3,
  canvasWidth: number,
  canvasHeight: number
): ScreenPoint | null {
  const depth = cameraPoint.y;
  if (depth <= 0.1) return null;
  return applyPerspective(cameraPoint, canvasWidth, canvasHeight);
}
