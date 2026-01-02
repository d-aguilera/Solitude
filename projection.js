import { rotate2D } from "./math.js";
import {
  planetCenter,
  vecNormalize,
  makeLocalFrame,
  vecSub,
} from "./planet.js";
import {
  plane,
  pilot,
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

// --- PROJECTION 2: TOP VIEW ---
// Orthographic top-down view from the topCamera position, looking down the
// radial axis through the plane. Plane is always at the center.

export function topView({ x, y, z }) {
  // Vector from camera to point
  const dx = x - topCamera.x;
  const dy = y - topCamera.y;
  const dz = z - topCamera.z;

  // Camera "up" is radial (from planet center to plane)
  const up = vecNormalize({
    x: plane.x - planetCenter.x,
    y: plane.y - planetCenter.y,
    z: plane.z - planetCenter.z,
  });

  // We want "forward" in the top view to match the plane plane forward direction
  // projected into the tangent plane.
  const planeForward = {
    x: plane.orientation[0][1],
    y: plane.orientation[1][1],
    z: plane.orientation[2][1],
  };

  // Project planeForward onto tangent plane (perpendicular to up)
  const dotF =
    planeForward.x * up.x + planeForward.y * up.y + planeForward.z * up.z;
  let forward = {
    x: planeForward.x - dotF * up.x,
    y: planeForward.y - dotF * up.y,
    z: planeForward.z - dotF * up.z,
  };
  const lenF = Math.hypot(forward.x, forward.y, forward.z);
  if (lenF > 0) {
    forward.x /= lenF;
    forward.y /= lenF;
    forward.z /= lenF;
  } else {
    // Fallback if degenerate: use makeLocalFrame
    ({ forward } = makeLocalFrame(up));
  }

  // right = forward × up
  const right = {
    x: forward.y * up.z - forward.z * up.y,
    y: forward.z * up.x - forward.x * up.z,
    z: forward.x * up.y - forward.y * up.x,
  };

  // Project point into this local tangent frame
  const cx = dx * right.x + dy * right.y + dz * right.z; // local right
  const cy = dx * forward.x + dy * forward.y + dz * forward.z; // local forward

  const worldSpan = 500; // world units from center to edge
  const sx = cx / worldSpan;
  const sy = cy / worldSpan;

  return {
    x: (0.5 + sx) * WIDTH,
    y: (0.5 - sy) * HEIGHT,
  };
}
