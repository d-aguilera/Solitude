import type { Mesh, Vec3 } from "../domain/domainPorts.js";
import type { RingBuffer } from "./RingBuffer.js";
import { Vec3RingBuffer } from "./RingBuffer.js";

export interface PlanetTrajectory {
  planetId: string;
  buffers: RingBuffer<Vec3>[];
}

export function createPlanetTrajectory(planetId: string): PlanetTrajectory {
  return {
    planetId,
    buffers: [
      new Vec3RingBuffer(20),
      new Vec3RingBuffer(30),
      new Vec3RingBuffer(50),
    ],
  };
}

export function updatePlanetTrajectory(
  trajectory: PlanetTrajectory,
  currentPosition: Vec3,
): void {
  const t = trajectory;

  let b = 0;
  let evicted: Vec3 | undefined = t.buffers[b].push({ ...currentPosition });
  while (evicted && t.buffers[b].tail === 0 && ++b < t.buffers.length) {
    evicted = t.buffers[b].push(evicted);
  }
}

export function rebuildPlanetPathMesh(
  traj: PlanetTrajectory,
  mesh: Mesh,
): void {
  const { points, faces } = mesh;
  const count = traj.buffers.reduce((acc, buf) => acc + buf.count, 0);
  points.length = count;

  // Collect points in from newest to oldest: G1 -> G2 -> ...
  let i = 0;
  traj.buffers.forEach((buf) => {
    buf.forEach((p) => {
      points[i++] = p;
    });
  });

  if (count < 2) {
    faces.length = 0;
    return;
  }

  faces.length = 1;
  faces[0] = [...Array(count).keys()];
}
