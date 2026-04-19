import type { ShipBody, World } from "../../domain/domainPorts";
import type { LocalFrame } from "../../domain/localFrame";
import type { Mat3 } from "../../domain/mat3";
import { getDominantBodyPrimary } from "../../domain/orbit";
import type { Vec3 } from "../../domain/vec3";
import { vec3 } from "../../domain/vec3";
import type {
  PlaybackRotatingBodySnapshot,
  PlaybackScenarioId,
  PlaybackShipSnapshot,
  PlaybackSnapshot,
} from "./types";

export function capturePlaybackSnapshot(
  world: World,
  mainShip: ShipBody,
  label: PlaybackScenarioId,
  capturedSimTimeMillis: number,
): PlaybackSnapshot {
  const primary = getDominantBodyPrimary(world, mainShip.position);
  return {
    metadata: {
      label,
      capturedSimTimeMillis,
      dominantBodyId: primary?.id ?? null,
    },
    ships: world.ships.map(captureShip),
    planets: world.planets.map(captureRotatingBody),
    stars: world.stars.map(captureRotatingBody),
  };
}

export function applyPlaybackSnapshot(
  snapshot: PlaybackSnapshot,
  world: World,
): boolean {
  if (!applyShipSnapshots(snapshot.ships, world.ships)) return false;
  if (!applyRotatingBodySnapshots(snapshot.planets, world.planets)) {
    return false;
  }
  if (!applyRotatingBodySnapshots(snapshot.stars, world.stars)) return false;
  return true;
}

function captureShip(ship: ShipBody): PlaybackShipSnapshot {
  return {
    id: ship.id,
    position: cloneVec3(ship.position),
    velocity: cloneVec3(ship.velocity),
    frame: cloneFrame(ship.frame),
    orientation: cloneMat3(ship.orientation),
    angularVelocity: { ...ship.angularVelocity },
  };
}

function captureRotatingBody({
  id,
  position,
  velocity,
  orientation,
}: World["planets"][number]): PlaybackRotatingBodySnapshot {
  return {
    id,
    position: cloneVec3(position),
    velocity: cloneVec3(velocity),
    orientation: cloneMat3(orientation),
  };
}

function applyShipSnapshots(
  snapshots: PlaybackShipSnapshot[],
  ships: World["ships"],
): boolean {
  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    const ship = findById(ships, snapshot.id);
    if (!ship) return false;
    copyVec3(ship.position, snapshot.position);
    copyVec3(ship.velocity, snapshot.velocity);
    copyFrame(ship.frame, snapshot.frame);
    copyMat3(ship.orientation, snapshot.orientation);
    ship.angularVelocity.roll = snapshot.angularVelocity.roll;
    ship.angularVelocity.pitch = snapshot.angularVelocity.pitch;
    ship.angularVelocity.yaw = snapshot.angularVelocity.yaw;
  }
  return true;
}

function applyRotatingBodySnapshots(
  snapshots: PlaybackRotatingBodySnapshot[],
  bodies: World["planets"],
): boolean {
  for (let i = 0; i < snapshots.length; i++) {
    const snapshot = snapshots[i];
    const body = findById(bodies, snapshot.id);
    if (!body) return false;
    copyVec3(body.position, snapshot.position);
    copyVec3(body.velocity, snapshot.velocity);
    copyMat3(body.orientation, snapshot.orientation);
  }
  return true;
}

function findById<T extends { id: string }>(items: T[], id: string): T | null {
  for (let i = 0; i < items.length; i++) {
    if (items[i].id === id) return items[i];
  }
  return null;
}

function cloneVec3(value: Vec3): Vec3 {
  return { x: value.x, y: value.y, z: value.z };
}

function cloneFrame(frame: LocalFrame): LocalFrame {
  return {
    right: cloneVec3(frame.right),
    forward: cloneVec3(frame.forward),
    up: cloneVec3(frame.up),
  };
}

function cloneMat3(value: Mat3): Mat3 {
  return [
    [value[0][0], value[0][1], value[0][2]],
    [value[1][0], value[1][1], value[1][2]],
    [value[2][0], value[2][1], value[2][2]],
  ];
}

function copyVec3(into: Vec3, value: Vec3): void {
  vec3.copyInto(into, value);
}

function copyFrame(into: LocalFrame, value: LocalFrame): void {
  copyVec3(into.right, value.right);
  copyVec3(into.forward, value.forward);
  copyVec3(into.up, value.up);
}

function copyMat3(into: Mat3, value: Mat3): void {
  into[0][0] = value[0][0];
  into[0][1] = value[0][1];
  into[0][2] = value[0][2];
  into[1][0] = value[1][0];
  into[1][1] = value[1][1];
  into[1][2] = value[1][2];
  into[2][0] = value[2][0];
  into[2][1] = value[2][1];
  into[2][2] = value[2][2];
}
