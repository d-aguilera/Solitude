import { HORIZONTAL_FOCAL_LENGTH } from "./config.js";
import { makeLocalFrameFromUp } from "./localFrame.js";
import type { LocalFrame, Vec3 } from "./types.js";

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

    state = {
      initialized: true,
      frame: {
        right: lf.right,
        forward,
        up: lf.forward,
      },
    };
  } else {
    let {
      right: topCameraRight,
      forward: topCameraForward,
      up: topCameraUp,
    } = state.frame;

    const dotR =
      topCameraRight.x * radialUp.x +
      topCameraRight.y * radialUp.y +
      topCameraRight.z * radialUp.z;
    let r: Vec3 = {
      x: topCameraRight.x - dotR * radialUp.x,
      y: topCameraRight.y - dotR * radialUp.y,
      z: topCameraRight.z - dotR * radialUp.z,
    };

    const dotU =
      topCameraUp.x * radialUp.x +
      topCameraUp.y * radialUp.y +
      topCameraUp.z * radialUp.z;
    let u: Vec3 = {
      x: topCameraUp.x - dotU * radialUp.x,
      y: topCameraUp.y - dotU * radialUp.y,
      z: topCameraUp.z - dotU * radialUp.z,
    };

    let lenR = Math.hypot(r.x, r.y, r.z);
    let lenU = Math.hypot(u.x, u.y, u.z);

    if (lenR < 1e-6 && lenU < 1e-6) {
      const frame = makeLocalFrameFromUp(radialUp);
      topCameraRight = frame.right;
      topCameraUp = frame.forward;
      topCameraForward = {
        x: -radialUp.x,
        y: -radialUp.y,
        z: -radialUp.z,
      };
    } else {
      if (lenR < 1e-6 && lenU >= 1e-6) {
        u.x /= lenU;
        u.y /= lenU;
        u.z /= lenU;
        r = {
          x: radialUp.y * u.z - radialUp.z * u.y,
          y: radialUp.z * u.x - radialUp.x * u.z,
          z: radialUp.x * u.y - radialUp.y * u.x,
        };
        lenR = Math.hypot(r.x, r.y, r.z) || 1;
      } else if (lenU < 1e-6 && lenR >= 1e-6) {
        r.x /= lenR;
        r.y /= lenR;
        r.z /= lenR;
        u = {
          x: r.y * radialUp.z - r.z * radialUp.y,
          y: r.z * radialUp.x - r.x * radialUp.z,
          z: r.x * radialUp.y - r.y * radialUp.x,
        };
        lenU = Math.hypot(u.x, u.y, u.z) || 1;
      }

      r.x /= lenR;
      r.y /= lenR;
      r.z /= lenR;

      u.x /= lenU;
      u.y /= lenU;
      u.z /= lenU;

      const cross: Vec3 = {
        x: radialUp.y * r.z - radialUp.z * r.y,
        y: radialUp.z * r.x - radialUp.x * r.z,
        z: radialUp.x * r.y - radialUp.y * r.x,
      };
      const dotCrossU = cross.x * u.x + cross.y * u.y + cross.z * u.z;
      if (dotCrossU < 0) {
        u.x = -u.x;
        u.y = -u.y;
        u.z = -u.z;
      }

      const dotPrevU =
        topCameraUp.x * u.x + topCameraUp.y * u.y + topCameraUp.z * u.z;
      if (dotPrevU < 0) {
        r.x = -r.x;
        r.y = -r.y;
        r.z = -r.z;
        u.x = -u.x;
        u.y = -u.y;
        u.z = -u.z;
      }

      const f: Vec3 = {
        x: -radialUp.x,
        y: -radialUp.y,
        z: -radialUp.z,
      };

      topCameraRight = r;
      topCameraUp = u;
      topCameraForward = f;
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

function worldPointToCameraPoint(
  { x, y, z }: Vec3,
  cameraPosition: Vec3,
  cameraFrame: LocalFrame
): Vec3 {
  const { right, forward, up } = cameraFrame;

  const dx = x - cameraPosition.x;
  const dy = y - cameraPosition.y;
  const dz = z - cameraPosition.z;

  return {
    x: dx * right.x + dy * right.y + dz * right.z,
    y: dx * up.x + dy * up.y + dz * up.z,
    z: dx * forward.x + dy * forward.y + dz * forward.z,
  };
}

function applyPilotLook(cameraPoint: Vec3, azimuth: number, elevation: number) {
  if (azimuth === 0 && elevation === 0) {
    return;
  }

  if (azimuth !== 0) {
    const r = rotate2D(cameraPoint.x, cameraPoint.z, -azimuth);
    cameraPoint.x = r.a;
    cameraPoint.z = r.b;
  }

  if (elevation !== 0) {
    const r = rotate2D(cameraPoint.y, cameraPoint.z, -elevation);
    cameraPoint.y = r.a;
    cameraPoint.z = r.b;
  }
}

function applyPerspective(
  { x: cx, y: cy, z: cz }: Vec3,
  canvasWidth: number,
  canvasHeight: number
): ScreenPoint {
  const aspect = canvasWidth / canvasHeight;

  const fX = HORIZONTAL_FOCAL_LENGTH;
  const fY = fX / aspect;

  // NDC in [-1, 1]
  const ndcX = (cx * fX) / cz;
  const ndcY = (cy * fY) / cz;

  return {
    x: (ndcX + 1) * 0.5 * canvasWidth,
    y: (1 - ndcY) * 0.5 * canvasHeight,
    depth: cz,
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
  if (cameraPoint.z <= 0.1) return null;
  return applyPerspective(cameraPoint, canvasWidth, canvasHeight);
}
