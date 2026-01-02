import { rotate2D } from "./math.js";
import { makeLocalFrame } from "./planet.js";
import {
  pilot,
  plane,
  topCamera,
  FOCAL_LENGTH,
  HEIGHT,
  WIDTH,
} from "./setup.js";

// --- PROJECTION 1: PILOT VIEW ---

export function pilotView({ x, y, z }) {
  // Vector from plane to point in world space
  const dx = x - plane.x;
  const dy = y - plane.y;
  const dz = z - plane.z;

  // Rebuild local axes from orientation matrix columns so camera matches plane
  const R = plane.orientation;
  const right = { x: R[0][0], y: R[1][0], z: R[2][0] };
  const forward = { x: R[0][1], y: R[1][1], z: R[2][1] };
  const up = { x: R[0][2], y: R[1][2], z: R[2][2] };

  // Transform into plane's local camera space:
  // cx = right (horizontal), cy = up (vertical), cz = forward (depth)
  let cx = dx * right.x + dy * right.y + dz * right.z;
  let cy = dx * up.x + dy * up.y + dz * up.z;
  let cz = dx * forward.x + dy * forward.y + dz * forward.z;

  // Apply pilot look as extra yaw (around up) and pitch (around right)
  if (pilot.azimuth !== 0 || pilot.elevation !== 0) {
    // Yaw around local up ⇒ rotate in (cx, cz) plane
    if (pilot.azimuth !== 0) {
      const r1 = rotate2D(cx, cz, -pilot.azimuth);
      cx = r1.a;
      cz = r1.b;
    }
    // Pitch around local right ⇒ rotate in (cy, cz) plane
    if (pilot.elevation !== 0) {
      const r2 = rotate2D(cy, cz, -pilot.elevation);
      cy = r2.a;
      cz = r2.b;
    }
  }

  if (cz <= 0.1) return null;

  return {
    x: ((cx * FOCAL_LENGTH) / cz + 0.5) * WIDTH,
    y: (0.5 - (cy * FOCAL_LENGTH) / cz) * HEIGHT,
  };
}

// --- PROJECTION 2: TOP VIEW CAMERA FRAME (PERSPECTIVE) ---

let topCamInitialized = false;

// Top-view camera axes in world space
export let topCameraForward = null; // towards planet
export let topCameraRight = null;
export let topCameraUp = null;

export function updateTopCameraFrame(radialUp) {
  // First-time initialization: choose any stable tangent frame from radialUp
  if (
    !topCamInitialized ||
    !topCameraRight ||
    !topCameraForward ||
    !topCameraUp
  ) {
    const frame = makeLocalFrame(radialUp);
    topCameraRight = frame.right;
    // We want the camera looking down toward the planet, so forward = -radialUp
    topCameraForward = {
      x: -radialUp.x,
      y: -radialUp.y,
      z: -radialUp.z,
    };
    topCameraUp = frame.forward; // use tangent forward as our "screen up"
    topCamInitialized = true;
    return;
  }

  // Project previous up/right/forward into the new tangent plane

  // 1) Project tcRight & tcUp into tangent plane
  const dotR =
    topCameraRight.x * radialUp.x +
    topCameraRight.y * radialUp.y +
    topCameraRight.z * radialUp.z;
  let r = {
    x: topCameraRight.x - dotR * radialUp.x,
    y: topCameraRight.y - dotR * radialUp.y,
    z: topCameraRight.z - dotR * radialUp.z,
  };

  const dotU =
    topCameraUp.x * radialUp.x +
    topCameraUp.y * radialUp.y +
    topCameraUp.z * radialUp.z;
  let u = {
    x: topCameraUp.x - dotU * radialUp.x,
    y: topCameraUp.y - dotU * radialUp.y,
    z: topCameraUp.z - dotU * radialUp.z,
  };

  let lenR = Math.hypot(r.x, r.y, r.z);
  let lenU = Math.hypot(u.x, u.y, u.z);

  // If both axes collapse, rebuild from scratch
  if (lenR < 1e-6 && lenU < 1e-6) {
    const frame = makeLocalFrame(radialUp);
    topCameraRight = frame.right;
    topCameraUp = frame.forward;
    topCameraForward = {
      x: -radialUp.x,
      y: -radialUp.y,
      z: -radialUp.z,
    };
    return;
  }

  // If only one axis collapsed, reconstruct
  if (lenR < 1e-6 && lenU >= 1e-6) {
    // normalize u, r = radialUp × u
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
    // normalize r, u = r × radialUp
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

  // Normalize both
  r.x /= lenR;
  r.y /= lenR;
  r.z /= lenR;

  u.x /= lenU;
  u.y /= lenU;
  u.z /= lenU;

  // Ensure right-handed: (radialUp, r, u)
  // cross = radialUp × r should match u; if not, flip u
  const cross = {
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

  // Keep continuity with previous up (avoid 180° flip over time)
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

  // Forward is always down along radial
  const f = {
    x: -radialUp.x,
    y: -radialUp.y,
    z: -radialUp.z,
  };

  // Store back
  topCameraRight = r;
  topCameraUp = u;
  topCameraForward = f;
}

export function topView({ x, y, z }) {
  const dx = x - topCamera.x;
  const dy = y - topCamera.y;
  const dz = z - topCamera.z;

  const R = topCamera.orientation;
  const right = { x: R[0][0], y: R[1][0], z: R[2][0] };
  const forward = { x: R[0][1], y: R[1][1], z: R[2][1] };
  const up = { x: R[0][2], y: R[1][2], z: R[2][2] };

  const cx = dx * right.x + dy * right.y + dz * right.z;
  const cy = dx * up.x + dy * up.y + dz * up.z;
  const cz = dx * forward.x + dy * forward.y + dz * forward.z;

  if (cz <= 0.1) return null;

  return {
    x: ((cx * FOCAL_LENGTH) / cz + 0.5) * WIDTH,
    y: (0.5 - (cy * FOCAL_LENGTH) / cz) * HEIGHT,
  };
}
