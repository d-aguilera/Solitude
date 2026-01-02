import { mat3, vec } from "./math.js";
import { keys } from "./input.js";
import {
  lookSpeed,
  rotSpeedRoll,
  rotSpeedPitch,
  rotSpeedYaw,
  plane,
  pilot,
  airplanes,
  type SceneObject,
} from "./setup.js";
import { PLANET_RADIUS, planetCenter } from "./planet.js";
import type { Mat3, Vec3 } from "./types.js";

export function updatePhysics(dtSeconds: number): void {
  pilotLookAround(dtSeconds);

  let Rlocal = yaw(pitch(roll(null, dtSeconds), dtSeconds), dtSeconds);

  if (Rlocal) {
    plane.orientation = mat3.mul(Rlocal, plane.orientation);
  }

  updatePlaneAxesSpherical();

  moveForwardSpherical(dtSeconds);

  const mainAirplane = airplanes[0] as SceneObject;
  mainAirplane.x = plane.x;
  mainAirplane.y = plane.y;
  mainAirplane.z = plane.z;
  mainAirplane.orientation = plane.orientation;
  mainAirplane.scale = plane.scale;
}

function pilotLookAround(dtSeconds: number): void {
  if (keys.Digit0) {
    pilot.azimuth = 0;
    pilot.elevation = 0;
  }
  if (keys.ArrowLeft) pilot.azimuth += lookSpeed * dtSeconds;
  if (keys.ArrowRight) pilot.azimuth -= lookSpeed * dtSeconds;
  if (keys.ArrowUp) pilot.elevation += lookSpeed * dtSeconds;
  if (keys.ArrowDown) pilot.elevation -= lookSpeed * dtSeconds;
}

export function updatePlaneAxesSpherical(): void {
  const pos: Vec3 = { x: plane.x, y: plane.y, z: plane.z };
  const fromCenter = vec.sub(pos, planetCenter);

  const radialUp = vec.normalize(fromCenter);

  const R = plane.orientation;
  let right: Vec3 = { x: R[0][0], y: R[1][0], z: R[2][0] };
  let forward: Vec3 = { x: R[0][1], y: R[1][1], z: R[2][1] };
  let up: Vec3 = { x: R[0][2], y: R[1][2], z: R[2][2] };

  const lenRight = vec.length(right) || 1;
  right = {
    x: right.x / lenRight,
    y: right.y / lenRight,
    z: right.z / lenRight,
  };

  const lenForward = vec.length(forward) || 1;
  forward = {
    x: forward.x / lenForward,
    y: forward.y / lenForward,
    z: forward.z / lenForward,
  };

  const lenUp = vec.length(up) || 1;
  up = { x: up.x / lenUp, y: up.y / lenUp, z: up.z / lenUp };

  plane.right = right;
  plane.forward = forward;
  plane.up = up;

  void radialUp; // kept in case you want it later
}

function roll(Rlocal: Mat3 | null, dtSeconds: number): Mat3 | null {
  if ((!keys.KeyA && !keys.KeyD) || (keys.KeyA && keys.KeyD)) {
    return Rlocal;
  }

  if (keys.KeyA) {
    const Rr = mat3.rotAxis(plane.forward, -rotSpeedRoll * dtSeconds);
    return Rlocal ? mat3.mul(Rr, Rlocal) : Rr;
  }

  const Rr = mat3.rotAxis(plane.forward, rotSpeedRoll * dtSeconds);
  return Rlocal ? mat3.mul(Rr, Rlocal) : Rr;
}

function pitch(Rlocal: Mat3 | null, dtSeconds: number): Mat3 | null {
  let pitchInput = 0;
  if (keys.KeyS) pitchInput += 1;
  if (keys.KeyW) pitchInput -= 1;
  if (pitchInput !== 0) {
    const Rp = mat3.rotAxis(
      plane.right,
      pitchInput * rotSpeedPitch * dtSeconds
    );
    Rlocal = Rlocal ? mat3.mul(Rp, Rlocal) : Rp;
  }
  return Rlocal;
}

function yaw(Rlocal: Mat3 | null, dtSeconds: number): Mat3 | null {
  if ((!keys.KeyQ && !keys.KeyE) || (keys.KeyQ && keys.KeyE)) {
    return Rlocal;
  }

  if (keys.KeyQ) {
    const Ry = mat3.rotAxis(plane.up, rotSpeedYaw * dtSeconds);
    return Rlocal ? mat3.mul(Ry, Rlocal) : Ry;
  }

  const Ry = mat3.rotAxis(plane.up, -rotSpeedYaw * dtSeconds);
  return Rlocal ? mat3.mul(Ry, Rlocal) : Ry;
}

function moveForwardSpherical(dtSeconds: number): void {
  const speed = plane.speed;

  const forward: Vec3 = {
    x: plane.orientation[0][1],
    y: plane.orientation[1][1],
    z: plane.orientation[2][1],
  };

  let newX = plane.x + forward.x * speed * dtSeconds;
  let newY = plane.y + forward.y * speed * dtSeconds;
  let newZ = plane.z + forward.z * speed * dtSeconds;

  const fromCenter = vec.sub({ x: newX, y: newY, z: newZ }, planetCenter);
  const len = vec.length(fromCenter);

  if (len < PLANET_RADIUS + 1) {
    const scale = (PLANET_RADIUS + 1) / len;
    newX = planetCenter.x + fromCenter.x * scale;
    newY = planetCenter.y + fromCenter.y * scale;
    newZ = planetCenter.z + fromCenter.z * scale;
  }

  plane.x = newX;
  plane.y = newY;
  plane.z = newZ;
}
