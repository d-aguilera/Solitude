import type {
  Mesh,
  PlanetPathMapping,
  ShipBody,
  Vec3,
} from "../domain/domainPorts.js";
import type { PlanetTrajectory } from "./appInternals.js";
import type { Scene } from "./appPorts.js";
import { Vec3RingBuffer } from "./Vec3RingBuffer.js";

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

export function appendPlanetTrajectories(
  scene: Scene,
  planetPathMappings: PlanetPathMapping[],
  planetTrajectories: PlanetTrajectory[],
): void {
  for (const mapping of planetPathMappings) {
    const bodyObj = scene.objects.find((o) => o.id === mapping.planetId);
    const pathObj = scene.objects.find((o) => o.id === mapping.pathId);
    if (!bodyObj || !pathObj) continue;

    const trajectory = planetTrajectories.find(
      (t) => t.planetId === mapping.planetId,
    );
    if (!trajectory) continue;

    // 1) Update trajectory tiers (1 second step implied)
    updatePlanetTrajectory(trajectory, bodyObj.position);

    // 2) Rebuild mesh from tiers
    rebuildPlanetPathMesh(trajectory, pathObj.mesh);
  }
}

/**
 * Sample and update trajectory polylines for the ship and planets.
 */
export function updateTrajectories(
  dtSeconds: number,
  scene: Scene,
  mainShip: ShipBody,
  planetPathMappings: PlanetPathMapping[],
  planetTrajectories: PlanetTrajectory[],
  trajectoryAccumTime: number,
): number {
  const sampleInterval = 1.0; // seconds

  trajectoryAccumTime += dtSeconds;

  while (trajectoryAccumTime >= sampleInterval) {
    appendShipTrajectoryPoint(scene, mainShip);
    appendPlanetTrajectories(scene, planetPathMappings, planetTrajectories);
    trajectoryAccumTime -= sampleInterval;
  }

  return trajectoryAccumTime;
}

/**
 * Append a point to a polyline mesh, adding a segment from the
 * previous point to this one.
 *
 * Mesh points are assumed to be in world space (no transform applied).
 */
export function appendPointToPolylineMesh(mesh: Mesh, point: Vec3): void {
  const newIndex = mesh.points.length;
  if (newIndex === 0) {
    mesh.points = [];
    mesh.points.push({ ...point });
    mesh.faces = [];
    return;
  }
  if (newIndex === 1) {
    mesh.points.push({ ...point });
    mesh.faces.push([0, 1]);
    return;
  }
  mesh.points.push({ ...point });
  mesh.faces[0].push(newIndex);
}

export function appendShipTrajectoryPoint(
  scene: Scene,
  mainShip: ShipBody,
): void {
  const pathObj = scene.objects.find((o) => o.id === "path:ship:main");
  if (pathObj) {
    appendPointToPolylineMesh(pathObj.mesh, mainShip.position);
  }
}
