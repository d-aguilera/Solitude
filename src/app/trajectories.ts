import type { BodyId, Mesh, ShipBody, Vec3 } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import { alloc } from "../global/allocProfiler.js";
import type { PlanetTrajectory } from "./appInternals.js";
import type { Scene } from "./appPorts.js";
import { RingBuffer } from "./RingBuffer.js";

export function createPlanetTrajectory(): PlanetTrajectory {
  return {
    buffers: [
      new RingBuffer<Vec3>(20),
      new RingBuffer<Vec3>(30),
      new RingBuffer<Vec3>(50),
    ],
  };
}

export function updatePlanetTrajectory(
  trajectory: PlanetTrajectory,
  currentPosition: Vec3,
): void {
  const t = trajectory;

  let b = 0;
  let evicted: Vec3 | undefined = t.buffers[b].push(
    vec3.clone(currentPosition),
  );
  while (evicted && t.buffers[b].tail === 0 && ++b < t.buffers.length) {
    evicted = t.buffers[b].push(evicted);
  }
}

let points: Vec3[];
let faces: number[][];
let buf: RingBuffer<Vec3>;
let count: number;

export function rebuildPlanetPathMesh(
  mesh: Mesh,
  traj: PlanetTrajectory,
): void {
  alloc.withName(rebuildPlanetPathMesh.name, () => {
    ({ points, faces } = mesh);
    count = traj.buffers.reduce((acc, buf) => acc + buf.count, 0);
    points.length = count;

    if (count === 0) {
      points.length = 1;
      faces.length = 0;
    } else if (count === 1) {
      points.length = 2;
    } else if (count === 2) {
      faces.length = 1;
      faces[0] = [0, 1];
    } else {
      const face = faces[0];
      if (face.length < count) {
        face.length = count;
        face[count - 1] = count - 1;
      }
    }

    // Collect points in from newest to oldest: G1 -> G2 -> ...
    let i = 0;
    for (buf of traj.buffers) {
      buf.forEach((p) => {
        // Reuse existing Vec3 instances where possible.
        let dst = points[i];
        if (!dst) {
          points[i] = vec3.clone(p);
        } else {
          vec3.copyInto(dst, p);
        }
        i++;
      });
    }
  });
}

export function appendPlanetTrajectories(
  scene: Scene,
  planetPathMappings: Record<BodyId, BodyId>,
  planetTrajectories: Record<BodyId, PlanetTrajectory>,
): void {
  const { objects } = scene;

  // build a scene objects lookup index
  const lookup: Record<BodyId, number> = {};
  for (let i = 0; i < objects.length; i++) {
    lookup[objects[i].id] = i;
  }

  for (const obj of objects) {
    if (obj.kind !== "planet" && obj.kind !== "star") continue;
    const pathId: BodyId = planetPathMappings[obj.id];
    const pathMesh: Mesh = objects[lookup[pathId]].mesh;
    const trajectory = planetTrajectories[obj.id];

    updatePlanetTrajectory(trajectory, obj.position);
    rebuildPlanetPathMesh(pathMesh, trajectory);
  }
}

const sampleInterval = 3.0; // seconds
let trajectoryAccumTime: number = 0;

/**
 * Sample and update trajectory polylines for the ship and planets.
 */
export function updateTrajectories(
  dtSeconds: number,
  scene: Scene,
  mainShip: ShipBody,
  planetPathMappings: Record<BodyId, BodyId>,
  planetTrajectories: Record<BodyId, PlanetTrajectory>,
): void {
  alloc.withName(updateTrajectories.name, () => {
    trajectoryAccumTime += dtSeconds;
    if (trajectoryAccumTime < sampleInterval) {
      return;
    }

    appendShipTrajectoryPoint(scene, mainShip);
    appendPlanetTrajectories(scene, planetPathMappings, planetTrajectories);

    do {
      trajectoryAccumTime -= sampleInterval;
    } while (trajectoryAccumTime >= sampleInterval);
  });
}

/**
 * Append a point to a polyline mesh, adding a segment from the
 * previous point to this one.
 *
 * Mesh points are assumed to be in world space (no transform applied).
 */
export function appendPointToPolylineMesh(mesh: Mesh, point: Vec3): void {
  return alloc.withName(appendPointToPolylineMesh.name, () => {
    const { faces, points } = mesh;
    const newIndex = points.length;

    if (newIndex === 0) {
      // initialize empty mesh
      points.length = 1;
      points[0] = vec3.clone(point);
      faces.length = 0;
      return;
    }

    if (newIndex === 1) {
      points.push(vec3.clone(point));
      faces.push([0, 1]);
      return;
    }

    // add current new point to the path
    points.push(vec3.clone(point));
    faces[0].push(newIndex);
  });
}

export function appendShipTrajectoryPoint(
  scene: Scene,
  mainShip: ShipBody,
): void {
  for (const obj of scene.objects) {
    if (obj.id !== "path:ship:main") continue;
    appendPointToPolylineMesh(obj.mesh, mainShip.position);
  }
}
