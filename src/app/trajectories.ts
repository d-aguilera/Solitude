import type { BodyId, Mesh, Vec3 } from "../domain/domainPorts.js";
import { vec3 } from "../domain/vec3.js";
import { alloc } from "../global/allocProfiler.js";
import type { Trajectory } from "./appInternals.js";
import type { SceneObject } from "./appPorts.js";
import { RingBuffer } from "./RingBuffer.js";

export function createTrajectory(): Trajectory {
  return {
    buffers: [
      new RingBuffer<Vec3>(20),
      new RingBuffer<Vec3>(30),
      new RingBuffer<Vec3>(50),
    ],
  };
}

function updateTrajectory({ buffers }: Trajectory, position: Vec3): void {
  let b = 0;
  let evicted: Vec3 | undefined = buffers[b].push(vec3.clone(position));
  while (evicted && buffers[b].tail === 0 && ++b < buffers.length)
    evicted = buffers[b].push(evicted);
}

function rebuildPathMesh(mesh: Mesh, { buffers }: Trajectory): void {
  alloc.withName(rebuildPathMesh.name, () => {
    const { points, faces } = mesh;
    const count = buffers.reduce((acc, buffer) => acc + buffer.count, 0);

    // update single face
    if (count < 2) {
      faces.length = 0;
    } else if (count < 3) {
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
    points.length = count;
    let i = 0;
    for (let buffer of buffers) {
      buffer.forEach((p) => {
        let dst = points[i];
        if (dst) {
          vec3.copyInto(dst, p);
        } else {
          points[i] = vec3.clone(p);
        }
        i++;
      });
    }
  });
}

const sampleInterval = 3.0; // seconds
let trajectoryAccumTime: number = 0;

/**
 * Sample and update trajectory polylines for the ship and planets.
 */
export function updateTrajectories(
  dtSeconds: number,
  objects: SceneObject[],
  planetPathMappings: Record<BodyId, BodyId>,
  trajectories: Record<BodyId, Trajectory>,
): void {
  alloc.withName(updateTrajectories.name, () => {
    trajectoryAccumTime += dtSeconds;
    if (trajectoryAccumTime < sampleInterval) {
      return;
    }

    // build a scene objects lookup index
    const lookup: Record<BodyId, number> = {};
    for (let i = 0; i < objects.length; i++) {
      lookup[objects[i].id] = i;
    }

    let pathId: BodyId;
    for (const obj of objects) {
      if (obj.kind === "planet" || obj.kind === "star") {
        pathId = planetPathMappings[obj.id];
      } else if (obj.kind === "ship") {
        pathId = "path:ship:main";
      } else {
        continue;
      }
      const pathMesh: Mesh = objects[lookup[pathId]].mesh;
      const trajectory = trajectories[obj.id];

      updateTrajectory(trajectory, obj.position);
      rebuildPathMesh(pathMesh, trajectory);
    }

    do {
      trajectoryAccumTime -= sampleInterval;
    } while (trajectoryAccumTime >= sampleInterval);
  });
}
