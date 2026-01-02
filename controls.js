import { mat3RotAxis, mat3Mul } from "./math.js";
import { keys } from "./input.js";
import {
  lookSpeed,
  rotSpeedRoll,
  rotSpeedPitch,
  rotSpeedYaw,
  plane,
  pilot,
  airplanes,
} from "./setup.js";
import {
  PLANET_RADIUS,
  planetCenter,
  vecSub,
  vecLength,
  vecNormalize,
  vecCross,
} from "./planet.js";

export function updatePhysics(dtSeconds) {
  pilotLookAround(dtSeconds);

  // Build local rotation from input around current axes
  let Rlocal = yaw(pitch(roll(null, dtSeconds), dtSeconds), dtSeconds);

  // Apply local rotation on the left (Rlocal * currentOrientation)
  if (Rlocal) {
    plane.orientation = mat3Mul(Rlocal, plane.orientation);
  }

  // After changing orientation, update derived axes so projections use
  // the new orientation this frame.
  updatePlaneAxesSpherical();

  moveForwardSpherical(dtSeconds);

  airplanes[0].x = plane.x;
  airplanes[0].y = plane.y;
  airplanes[0].z = plane.z;
  airplanes[0].orientation = plane.orientation;
  airplanes[0].scale = plane.scale;
}

// Pilot Look (apply azimuth/elevation changes over time)
function pilotLookAround(dtSeconds) {
  if (keys.Digit0) {
    pilot.azimuth = 0;
    pilot.elevation = 0;
  }
  if (keys.ArrowLeft) pilot.azimuth += lookSpeed * dtSeconds;
  if (keys.ArrowRight) pilot.azimuth -= lookSpeed * dtSeconds;
  if (keys.ArrowUp) pilot.elevation += lookSpeed * dtSeconds;
  if (keys.ArrowDown) pilot.elevation -= lookSpeed * dtSeconds;
}

// Extract current local axes from orientation (columns), but recompute up
// from planet center so we stay tangent to the sphere.
export function updatePlaneAxesSpherical() {
  const pos = { x: plane.x, y: plane.y, z: plane.z };
  const fromCenter = vecSub(pos, planetCenter);

  // Radial up (for HUD/top view, etc.), but DO NOT overwrite orientation
  const radialUp = vecNormalize(fromCenter);

  // Extract current local axes from orientation (columns)
  const R = plane.orientation;
  let right = { x: R[0][0], y: R[1][0], z: R[2][0] };
  let forward = { x: R[0][1], y: R[1][1], z: R[2][1] };
  let up = { x: R[0][2], y: R[1][2], z: R[2][2] };

  // Optionally keep track of the radial up separately if you like:
  // plane.radialUp = radialUp;

  // Just update the derived vectors from the orientation;
  // do NOT project them back onto the tangent plane in a way that
  // destroys roll/pitch. You can simply normalize them:
  const lenRight = vecLength(right) || 1;
  right = {
    x: right.x / lenRight,
    y: right.y / lenRight,
    z: right.z / lenRight,
  };

  const lenForward = vecLength(forward) || 1;
  forward = {
    x: forward.x / lenForward,
    y: forward.y / lenForward,
    z: forward.z / lenForward,
  };

  const lenUp = vecLength(up) || 1;
  up = { x: up.x / lenUp, y: up.y / lenUp, z: up.z / lenUp };

  plane.right = right;
  plane.forward = forward;
  plane.up = up;

  // IMPORTANT: do NOT overwrite plane.orientation here.
  // plane.orientation remains the true attitude matrix.
}

// Roll (A/D) around local forward axis
function roll(Rlocal, dtSeconds) {
  if ((!keys.KeyA && !keys.KeyD) || (keys.KeyA && keys.KeyD)) {
    return Rlocal;
  }

  if (keys.KeyA) {
    const Rr = mat3RotAxis(plane.forward, -rotSpeedRoll * dtSeconds);
    return Rlocal ? mat3Mul(Rr, Rlocal) : Rr;
  }

  const Rr = mat3RotAxis(plane.forward, rotSpeedRoll * dtSeconds);
  return Rlocal ? mat3Mul(Rr, Rlocal) : Rr;
}

// Pitch (W/S): S = pull nose up, W = nose down
function pitch(Rlocal, dtSeconds) {
  let pitchInput = 0;
  if (keys.KeyS) pitchInput += 1; // pull back: nose up
  if (keys.KeyW) pitchInput -= 1; // push forward: nose down
  if (pitchInput !== 0) {
    const Rp = mat3RotAxis(plane.right, pitchInput * rotSpeedPitch * dtSeconds);
    Rlocal = Rlocal ? mat3Mul(Rp, Rlocal) : Rp;
  }
  return Rlocal;
}

// Yaw (Q/E) around local up axis
function yaw(Rlocal, dtSeconds) {
  if ((!keys.KeyQ && !keys.KeyE) || (keys.KeyQ && keys.KeyE)) {
    return Rlocal;
  }

  if (keys.KeyQ) {
    const Ry = mat3RotAxis(plane.up, rotSpeedYaw * dtSeconds); // yaw left
    return Rlocal ? mat3Mul(Ry, Rlocal) : Ry;
  }

  const Ry = mat3RotAxis(plane.up, -rotSpeedYaw * dtSeconds); // yaw right
  return Rlocal ? mat3Mul(Ry, Rlocal) : Ry;
}

// Move plane forward on the spherical surface
function moveForwardSpherical(dtSeconds) {
  const speed = plane.speed;

  // Use current orientation forward column
  const forward = {
    x: plane.orientation[0][1],
    y: plane.orientation[1][1],
    z: plane.orientation[2][1],
  };

  // Move in world space
  let newX = plane.x + forward.x * speed * dtSeconds;
  let newY = plane.y + forward.y * speed * dtSeconds;
  let newZ = plane.z + forward.z * speed * dtSeconds;

  // Keep above surface (no tunneling into planet)
  const fromCenter = vecSub({ x: newX, y: newY, z: newZ }, planetCenter);
  const len = vecLength(fromCenter);

  if (len < PLANET_RADIUS + 1) {
    // If we went below surface, clamp to just above it
    const scale = (PLANET_RADIUS + 1) / len;
    newX = planetCenter.x + fromCenter.x * scale;
    newY = planetCenter.y + fromCenter.y * scale;
    newZ = planetCenter.z + fromCenter.z * scale;
  }

  plane.x = newX;
  plane.y = newY;
  plane.z = newZ;
}
