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

export function updatePhysics(dtSeconds) {
  pilotLookAround(dtSeconds);
  updatePlaneAxes();

  let Rlocal = yaw(pitch(roll(null, dtSeconds), dtSeconds), dtSeconds);

  // Apply local rotation on the left
  if (Rlocal) {
    plane.orientation = mat3Mul(Rlocal, plane.orientation);
  }

  moveForward(dtSeconds);

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

// Extract current local axes from orientation (columns)
function updatePlaneAxes() {
  const R = plane.orientation;
  const [R0, R1, R2] = R;
  plane.right = { x: R0[0], y: R1[0], z: R2[0] };
  plane.forward = { x: R0[1], y: R1[1], z: R2[1] };
  plane.up = { x: R0[2], y: R1[2], z: R2[2] };
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

// Move plane forward
function moveForward(dtSeconds) {
  // Forward vector for movement = 2nd column (index 1)
  const forward = {
    x: plane.orientation[0][1],
    y: plane.orientation[1][1],
    z: plane.orientation[2][1],
  };

  const speed = plane.speed; // m/s

  // Move plane forward: x += v * dt
  plane.x += forward.x * speed * dtSeconds;
  plane.y += forward.y * speed * dtSeconds;
  plane.z += forward.z * speed * dtSeconds;
}
