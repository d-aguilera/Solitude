import { FOCAL_LENGTH, HEIGHT, WIDTH } from "./config.js";
import { rotate2D } from "./math.js";
import { makeLocalFrame } from "./planet.js";
import type { Vec3, Mat3 } from "./types.js";

export interface ScreenPoint {
  x: number;
  y: number;
  depth?: number; // camera-space depth (positive means in front of camera)
}

export interface PilotViewContext {
  cameraPosition: Vec3;
  cameraOrientation: Mat3;
  pilotAzimuth: number;
  pilotElevation: number;
}

export interface TopViewContext {
  cameraPosition: Vec3;
  cameraOrientation: Mat3;
}

// --- PROJECTION 1: PILOT VIEW ---

export function makePilotView(ctx: PilotViewContext) {
  return function pilotView({ x, y, z }: Vec3): ScreenPoint | null {
    const R = ctx.cameraOrientation;
    const right: Vec3 = { x: R[0][0], y: R[1][0], z: R[2][0] };
    const forward: Vec3 = { x: R[0][1], y: R[1][1], z: R[2][1] };
    const up: Vec3 = { x: R[0][2], y: R[1][2], z: R[2][2] };

    const cameraX = ctx.cameraPosition.x;
    const cameraY = ctx.cameraPosition.y;
    const cameraZ = ctx.cameraPosition.z;

    // Vector from camera to point
    const dx = x - cameraX;
    const dy = y - cameraY;
    const dz = z - cameraZ;

    // Transform to camera space
    let cx = dx * right.x + dy * right.y + dz * right.z;
    let cy = dx * up.x + dy * up.y + dz * up.z;
    let cz = dx * forward.x + dy * forward.y + dz * forward.z;

    if (ctx.pilotAzimuth !== 0 || ctx.pilotElevation !== 0) {
      if (ctx.pilotAzimuth !== 0) {
        const r1 = rotate2D(cx, cz, -ctx.pilotAzimuth);
        cx = r1.a;
        cz = r1.b;
      }
      if (ctx.pilotElevation !== 0) {
        const r2 = rotate2D(cy, cz, -ctx.pilotElevation);
        cy = r2.a;
        cz = r2.b;
      }
    }

    if (cz <= 0.1) return null;

    return {
      x: ((cx * FOCAL_LENGTH) / cz + 0.5) * WIDTH,
      y: (0.5 - (cy * FOCAL_LENGTH) / cz) * HEIGHT,
      depth: cz,
    };
  };
}

// --- PROJECTION 2: TOP VIEW CAMERA FRAME (PERSPECTIVE) ---

export interface TopCameraFrameState {
  initialized: boolean;
  right: Vec3;
  forward: Vec3;
  up: Vec3;
}

/**
 * Computes an updated top-camera orientation frame given the current radialUp.
 * The function is pure: it takes the previous frame state and returns a new one.
 * Callers can store this state between frames.
 */
export function updateTopCameraFrame(
  radialUp: Vec3,
  prevState: TopCameraFrameState | null
): { orientation: Mat3; state: TopCameraFrameState } {
  let state = prevState;

  if (!state || !state.initialized) {
    const frame = makeLocalFrame(radialUp);
    const right = frame.right;
    const forward: Vec3 = {
      x: -radialUp.x,
      y: -radialUp.y,
      z: -radialUp.z,
    };
    const up = frame.forward;

    state = {
      initialized: true,
      right,
      forward,
      up,
    };
  } else {
    let topCameraRight = state.right;
    let topCameraForward = state.forward;
    let topCameraUp = state.up;

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
      const frame = makeLocalFrame(radialUp);
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
      right: state ? state.right : { x: 1, y: 0, z: 0 },
      forward: state ? state.forward : { x: 0, y: 1, z: 0 },
      up: state ? state.up : { x: 0, y: 0, z: 1 },
    };
    state.right = topCameraRight;
    state.forward = topCameraForward;
    state.up = topCameraUp;
  }

  const orientation: Mat3 = [
    [state.right.x, state.forward.x, state.up.x],
    [state.right.y, state.forward.y, state.up.y],
    [state.right.z, state.forward.z, state.up.z],
  ];

  return { orientation, state };
}

export function makeTopView(ctx: TopViewContext) {
  return function topView({ x, y, z }: Vec3): ScreenPoint | null {
    const dx = x - ctx.cameraPosition.x;
    const dy = y - ctx.cameraPosition.y;
    const dz = z - ctx.cameraPosition.z;

    const R = ctx.cameraOrientation;
    const right: Vec3 = { x: R[0][0], y: R[1][0], z: R[2][0] };
    const forward: Vec3 = { x: R[0][1], y: R[1][1], z: R[2][1] };
    const up: Vec3 = { x: R[0][2], y: R[1][2], z: R[2][2] };

    const cx = dx * right.x + dy * right.y + dz * right.z;
    const cy = dx * up.x + dy * up.y + dz * up.z;
    const cz = dx * forward.x + dy * forward.y + dz * forward.z;

    if (cz <= 0.1) return null;

    return {
      x: ((cx * FOCAL_LENGTH) / cz + 0.5) * WIDTH,
      y: (0.5 - (cy * FOCAL_LENGTH) / cz) * HEIGHT,
      depth: cz,
    };
  };
}
